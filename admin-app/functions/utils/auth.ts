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

const PLACEHOLDER_TEAM_DOMAINS = new Set(['', 'daily-scot-team', 'your-team', 'my-team']);
const PLACEHOLDER_AUDS = new Set(['', 'YOUR_CF_ACCESS_AUD_TAG']);

/**
 * Returns an error message if Cloudflare Access is not properly configured, otherwise null.
 * Authentication FAILS CLOSED: with placeholder or missing values nobody can sign in.
 */
export function getAccessConfigError(teamDomain?: string, expectedAud?: string): string | null {
  if (!teamDomain || PLACEHOLDER_TEAM_DOMAINS.has(teamDomain.trim()) || /^REPLACE_WITH/i.test(teamDomain.trim())) {
    return 'CF_ACCESS_TEAM_DOMAIN is not configured';
  }
  if (
    !expectedAud ||
    PLACEHOLDER_AUDS.has(expectedAud.trim()) ||
    /^REPLACE_WITH/i.test(expectedAud.trim()) ||
    /^x+$/i.test(expectedAud.trim())
  ) {
    return 'CF_ACCESS_AUD is not configured';
  }
  return null;
}

/**
 * Validates Cloudflare Access JWT Assertion header (Cf-Access-Jwt-Assertion).
 * ALWAYS verifies the RS256 signature against the team's public certs, plus expiry,
 * not-before, issuer and audience. Never skips a check.
 * Cloudflare Access service-token JWTs have no email, only common_name (the Client ID).
 */
export async function verifyCloudflareAccessJwt(
  jwt: string,
  teamDomain?: string,
  expectedAud?: string
): Promise<{ email?: string; common_name?: string; sub: string } | null> {
  try {
    if (getAccessConfigError(teamDomain, expectedAud)) return null;
    const team = teamDomain!.trim();
    const aud = expectedAud!.trim();

    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64)) as { alg?: string; kid?: string };
    const payload: JwtPayload & { nbf?: number } = JSON.parse(base64UrlDecode(payloadB64));

    // 1. Algorithm and key id are mandatory
    if (header.alg !== 'RS256' || !header.kid) {
      console.warn('CF Access JWT rejected: unexpected alg or missing kid');
      return null;
    }

    // 2. Cryptographic signature check against team certs (always)
    const keyValid = await verifySignatureWithCerts(team, header.kid, `${headerB64}.${payloadB64}`, signatureB64);
    if (!keyValid) {
      console.warn('CF Access JWT signature verification failed');
      return null;
    }

    // 3. Expiry / not-before (allow 60s clock skew)
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now - 60) {
      console.warn('CF Access JWT expired or missing exp');
      return null;
    }
    if (payload.nbf && payload.nbf > now + 60) {
      console.warn('CF Access JWT not yet valid');
      return null;
    }

    // 4. Issuer must be this team
    if (payload.iss !== `https://${team}.cloudflareaccess.com`) {
      console.warn('CF Access JWT ISS mismatch:', payload.iss);
      return null;
    }

    // 5. Audience must include this Access application
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) {
      console.warn('CF Access JWT AUD mismatch');
      return null;
    }

    // 6. Must identify a person (email) or a service token (common_name)
    const hasEmail = typeof payload.email === 'string' && payload.email.includes('@');
    const hasCommonName = typeof payload.common_name === 'string' && payload.common_name.trim().length > 0;
    if (!hasEmail && !hasCommonName) {
      console.warn('CF Access JWT missing email and common_name in payload');
      return null;
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

async function fetchCerts(teamDomain: string, force = false): Promise<any[]> {
  const now = Date.now();
  if (force || !certsCache || now - certsCache.fetchedAt > CERTS_CACHE_TTL) {
    const res = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`Failed to fetch Access certs: HTTP ${res.status}`);
    const data = (await res.json()) as { keys: any[] };
    certsCache = { keys: data.keys || [], fetchedAt: now };
  }
  return certsCache!.keys;
}

async function verifySignatureWithCerts(
  teamDomain: string,
  kid: string,
  dataString: string,
  signatureB64: string
): Promise<boolean> {
  try {
    let keys = await fetchCerts(teamDomain);
    let jwk = keys.find((k: any) => k.kid === kid);
    if (!jwk) {
      // Keys rotate – refresh once before giving up
      keys = await fetchCerts(teamDomain, true);
      jwk = keys.find((k: any) => k.kid === kid);
    }
    if (!jwk) return false;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataBytes = new TextEncoder().encode(dataString);
    const binarySig = base64UrlDecode(signatureB64);
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

/** Constant-time string comparison to avoid timing leaks on secrets. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isIngestPath(request: Request): boolean {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return path === '/api/admin/ingest';
}

/** Loads the Bot user row (must exist in D1 – created by migrations/0002). */
async function loadBotUser(env: Env): Promise<User | null> {
  try {
    return await env.DB.prepare(
      "SELECT id, email, name, role, bio, photo, active, created_at FROM users WHERE role = 'Bot' AND active = 1 ORDER BY created_at ASC LIMIT 1"
    ).first<User>();
  } catch (e) {
    console.warn('Bot user lookup failed', e);
    return null;
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
  const isLocalDev = env.ENVIRONMENT === 'local';

  const configError = getAccessConfigError(env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
  if (configError && !isLocalDev) {
    console.error(`Admin auth disabled: ${configError}`);
    return {
      user: null,
      errorResponse: jsonError(`Server misconfigured: ${configError}. Set it in the Pages project settings.`, 503),
    };
  }

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
      if (!botClientId || !timingSafeEqual(claims.common_name, botClientId)) {
        return { user: null, errorResponse: jsonError('Unauthorized: Unknown service token', 403) };
      }
      if (!isIngestPath(request)) {
        return { user: null, errorResponse: jsonError('Access Denied: Bot role may only access /api/admin/ingest', 403) };
      }
      const botUser = await loadBotUser(env);
      if (!botUser) {
        return { user: null, errorResponse: jsonError('Bot user is not configured in the database', 500) };
      }
      return { user: botUser };
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
  if (!email && isLocalDev) {
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
      if (!isIngestPath(request)) {
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
 * Authenticates Cloudflare Access Service Token headers (CF-Access-Client-Id / CF-Access-Client-Secret).
 * Normally Cloudflare Access validates these at the edge and forwards a signed JWT instead; this path is a
 * fallback and FAILS CLOSED unless both expected values are configured as secrets.
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
      errorResponse: jsonError('Unauthorized: Service token headers required (CF-Access-Client-Id, CF-Access-Client-Secret)', 401),
    };
  }

  const expectedId = env.CF_ACCESS_SERVICE_CLIENT_ID;
  const expectedSecret = env.CF_ACCESS_SERVICE_CLIENT_SECRET;

  if (!expectedId || !expectedSecret) {
    return { user: null, errorResponse: jsonError('Unauthorized: Service token authentication is not configured', 401) };
  }

  const idOk = timingSafeEqual(clientId, expectedId);
  const secretOk = timingSafeEqual(clientSecret, expectedSecret);
  if (!idOk || !secretOk) {
    return { user: null, errorResponse: jsonError('Unauthorized: Invalid service token credentials', 401) };
  }

  if (!isIngestPath(request)) {
    return { user: null, errorResponse: jsonError('Access Denied: Bot role may only access /api/admin/ingest', 403) };
  }

  const botUser = await loadBotUser(env);
  if (!botUser) {
    return { user: null, errorResponse: jsonError('Bot user is not configured in the database', 500) };
  }
  return { user: botUser };
}
