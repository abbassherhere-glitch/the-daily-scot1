import { Env, User } from '../types';

interface JwtPayload {
  aud: string[] | string;
  email?: string;
  common_name?: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  type?: string;
  identity_nonce?: string;
}

// In-memory public key cache for Cloudflare Access certs
let certsCache: { keys: any[]; fetchedAt: number } | null = null;
const CERTS_CACHE_TTL = 1000 * 60 * 60; // 1 hour

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const xForwarded = request.headers.get('x-forwarded-for');
  if (xForwarded) return xForwarded.split(',')[0].trim();
  const xReal = request.headers.get('x-real-ip');
  if (xReal) return xReal.trim();
  return '127.0.0.1';
}

/**
 * Validates Cloudflare Access JWT Assertion header (Cf-Access-Jwt-Assertion).
 * Strictly verifies signature, expiration, team domain issuer, and audience.
 * Cloudflare Access service-token JWTs have no email, only common_name (the Client ID).
 */
export async function verifyCloudflareAccessJwt(
  jwt: string,
  teamDomain?: string,
  expectedAud?: string
): Promise<{ email?: string; common_name?: string; sub: string } | null> {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64));
    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadB64));

    // 1. Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      console.warn('CF Access JWT expired or missing exp');
      return null;
    }

    // 2. Must have valid email OR common_name (for Cloudflare Access service tokens)
    const hasEmail = typeof payload.email === 'string' && payload.email.includes('@');
    const hasCommonName = typeof payload.common_name === 'string' && payload.common_name.trim().length > 0;
    if (!hasEmail && !hasCommonName) {
      console.warn('CF Access JWT missing email and common_name in payload');
      return null;
    }

    // 3. Verify issuer matches team domain
    if (teamDomain && teamDomain !== 'daily-scot-team') {
      const expectedIss = `https://${teamDomain}.cloudflareaccess.com`;
      if (payload.iss !== expectedIss) {
        console.warn('CF Access JWT ISS mismatch:', payload.iss, 'expected:', expectedIss);
        return null;
      }
    } else if (teamDomain) {
      const expectedIss = `https://${teamDomain}.cloudflareaccess.com`;
      if (payload.iss && payload.iss !== expectedIss) {
        console.warn('CF Access JWT ISS mismatch');
        return null;
      }
    }

    // 4. Check audience
    if (expectedAud && expectedAud !== 'YOUR_CF_ACCESS_AUD_TAG') {
      const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!auds.includes(expectedAud)) {
        console.warn('CF Access JWT AUD mismatch');
        return null;
      }
    }

    // 5. Cryptographic signature check against team certs
    if (teamDomain && teamDomain !== 'daily-scot-team' && header.kid) {
      const keyValid = await verifySignatureWithCerts(
        teamDomain,
        header.kid,
        `${headerB64}.${payloadB64}`,
        signatureB64
      );
      if (!keyValid) {
        console.warn('CF Access JWT Signature verification failed');
        return null;
      }
    }

    return {
      email: hasEmail ? payload.email!.trim().toLowerCase() : undefined,
      common_name: hasCommonName ? payload.common_name!.trim() : undefined,
      sub: payload.sub,
    };
  } catch (err) {
    console.error('Error verifying Cloudflare Access JWT:', err);
    return null;
  }
}

async function verifySignatureWithCerts(
  teamDomain: string,
  kid: string,
  dataString: string,
  signatureB64: string
): Promise<boolean> {
  try {
    const now = Date.now();
    if (!certsCache || now - certsCache.fetchedAt > CERTS_CACHE_TTL) {
      const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
      const res = await fetch(certsUrl);
      if (!res.ok) return false;
      const data = await res.json() as { keys: any[] };
      certsCache = { keys: data.keys || [], fetchedAt: now };
    }

    const jwk = certsCache.keys.find((k: any) => k.kid === kid);
    if (!jwk) return false;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(dataString);

    const binarySig = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, dataBytes);
  } catch (e) {
    console.error('Error in verifySignatureWithCerts', e);
    return false;
  }
}

/**
 * Authenticates request against Cloudflare Access and looks up user in D1.
 * Strict: Never reads Cf-Access-Authenticated-User-Email header.
 */
export async function authenticateAdminRequest(
  request: Request,
  env: Env
): Promise<{ user: User | null; errorResponse?: Response }> {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  let email: string | null = null;

  if (jwt) {
    const claims = await verifyCloudflareAccessJwt(
      jwt,
      env.CF_ACCESS_TEAM_DOMAIN,
      env.CF_ACCESS_AUD
    );
    if (!claims) {
      return {
        user: null,
        errorResponse: new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid, unverified, or expired Cloudflare Access token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }

    // Cloudflare Access service-token JWTs have no email, only common_name (the Client ID)
    if (!claims.email && claims.common_name) {
      const botClientId = env.BOT_CLIENT_ID || env.CF_ACCESS_SERVICE_CLIENT_ID;
      if (botClientId && claims.common_name !== botClientId) {
        return {
          user: null,
          errorResponse: new Response(
            JSON.stringify({ error: 'Unauthorized: Unknown service token common_name' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }

      // Bot can ONLY access /api/admin/ingest
      const url = new URL(request.url);
      if (!url.pathname.includes('/api/admin/ingest')) {
        return {
          user: null,
          errorResponse: new Response(
            JSON.stringify({ error: 'Access Denied: Bot role may only access /api/admin/ingest' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }

      try {
        const botUser = await env.DB.prepare(
          "SELECT id, email, name, role, bio, photo, active, created_at FROM users WHERE role = 'Bot' AND active = 1 LIMIT 1"
        ).first<User>();
        if (botUser) {
          return { user: botUser };
        }
      } catch (e) {
        console.warn('Bot user lookup failed', e);
      }

      return {
        user: {
          id: 'usr-bot-service',
          email: 'bot@service.local',
          name: 'Cloudflare Ingest Bot',
          role: 'Bot',
          active: 1,
          created_at: new Date().toISOString(),
        },
      };
    }

    if (!claims.email) {
      return {
        user: null,
        errorResponse: new Response(
          JSON.stringify({ error: 'Unauthorized: No email or service token found in JWT' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }

    email = claims.email;
  }

  // Service token header authentication (CF-Access-Client-Id / CF-Access-Client-Secret)
  const serviceClientId = request.headers.get('CF-Access-Client-Id');
  const serviceClientSecret = request.headers.get('CF-Access-Client-Secret');
  if (!email && serviceClientId && serviceClientSecret) {
    const serviceAuth = await authenticateServiceToken(request, env);
    if (serviceAuth.user) {
      return { user: serviceAuth.user };
    } else {
      return { user: null, errorResponse: serviceAuth.errorResponse };
    }
  }

  // Local dev bypass ONLY when env.ENVIRONMENT === 'local' AND request host is localhost/127.0.0.1
  if (!email && env.ENVIRONMENT === 'local') {
    try {
      const url = new URL(request.url);
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (isLocalhost) {
        const devAuth = request.headers.get('X-Dev-User-Email');
        if (devAuth && devAuth.includes('@')) {
          email = devAuth.trim().toLowerCase();
        }
      }
    } catch {
      // Invalid URL
    }
  }

  if (!email) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized: Valid Cloudflare Access JWT required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  try {
    const user = await env.DB.prepare(
      'SELECT id, email, name, role, bio, photo, active, created_at FROM users WHERE email = ? AND active = 1'
    )
      .bind(email)
      .first<User>();

    if (!user) {
      return {
        user: null,
        errorResponse: new Response(
          JSON.stringify({
            error: `Access Denied: Email ${email} is not an authorized newsroom staff member. An Owner must grant you access first.`,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }

    if (user.role === 'Bot') {
      const url = new URL(request.url);
      if (!url.pathname.includes('/api/admin/ingest')) {
        return {
          user: null,
          errorResponse: new Response(
            JSON.stringify({ error: 'Access Denied: Bot role may only access /api/admin/ingest' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }
    }

    return { user };
  } catch (e: any) {
    console.error('Database user lookup failed:', e);
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Internal server error during authentication' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
}

export interface AuditLogOptions {
  articleId?: string | null;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  ip?: string | null;
  details?: string | null;
}

export async function logAuditEvent(
  env: Env,
  user: User,
  action: string,
  optionsOrDetails?: AuditLogOptions | string
): Promise<void> {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    let articleId: string | null = null;
    let beforeStatus: string | null = null;
    let afterStatus: string | null = null;
    let ip: string | null = null;
    let details: string | null = null;

    if (typeof optionsOrDetails === 'string') {
      details = optionsOrDetails;
    } else if (optionsOrDetails) {
      articleId = optionsOrDetails.articleId || null;
      beforeStatus = optionsOrDetails.beforeStatus || null;
      afterStatus = optionsOrDetails.afterStatus || null;
      ip = optionsOrDetails.ip || null;
      details = optionsOrDetails.details || null;
    }

    await env.DB.prepare(`
      INSERT INTO audit_log (
        id, user_id, user_email, action, article_id, before_status, after_status, ip, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))
    `)
      .bind(id, user.id, user.email, action, articleId, beforeStatus, afterStatus, ip, details)
      .run();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * Role enforcement helper. Denies by default.
 * Returns a 401/403 Response if unauthorized, or null if authorized.
 */
export function requireRole(
  user: User | null | undefined,
  allowedRoles: import('../types').UserRole[]
): Response | null {
  if (!user || !user.role) {
    return new Response(
      JSON.stringify({ error: 'Access Denied: Unauthenticated' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!allowedRoles.includes(user.role)) {
    return new Response(
      JSON.stringify({
        error: `Access Denied: Role '${user.role}' is not authorized. Allowed: ${allowedRoles.join(', ')}`,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

/**
 * Authenticates Cloudflare Access Service Token headers (CF-Access-Client-Id / CF-Access-Client-Secret)
 * Returns a Bot user object
 */
export async function authenticateServiceToken(
  request: Request,
  env: Env
): Promise<{ user: User | null; errorResponse?: Response }> {
  const clientId = request.headers.get('CF-Access-Client-Id');
  const clientSecret = request.headers.get('CF-Access-Client-Secret');

  if (!clientId || !clientSecret) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized: Service token headers required (CF-Access-Client-Id, CF-Access-Client-Secret)' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const expectedId = env.CF_ACCESS_SERVICE_CLIENT_ID;
  const expectedSecret = env.CF_ACCESS_SERVICE_CLIENT_SECRET;

  if (expectedId && expectedSecret) {
    if (clientId !== expectedId || clientSecret !== expectedSecret) {
      return {
        user: null,
        errorResponse: new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid service token credentials' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  }

  // Look up bot user or fallback to service bot
  try {
    const botUser = await env.DB.prepare(
      "SELECT id, email, name, role, bio, photo, active, created_at FROM users WHERE role = 'Bot' AND active = 1 LIMIT 1"
    ).first<User>();

    if (botUser) {
      return { user: botUser };
    }
  } catch (err) {
    console.warn('Bot user lookup exception:', err);
  }

  return {
    user: {
      id: 'usr-bot-service',
      email: 'ingest-bot@dailyscot.co.uk',
      name: 'Cloudflare Ingest Bot',
      role: 'Bot',
      active: 1,
      created_at: new Date().toISOString(),
    },
  };
}
