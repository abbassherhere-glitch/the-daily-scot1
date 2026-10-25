import { Env, User } from '../types';

/**
 * Shared-secret authentication for Newsdesk's calls to POST /api/admin/ingest.
 *
 * The secret is the Pages secret NEWSDESK_INGEST_SECRET (the same value is stored as a secret of the
 * same name in the Newsdesk Worker). Nothing secret travels on the wire: each request carries
 *
 *   X-Newsdesk-Timestamp  Unix time in seconds when the request was signed
 *   X-Newsdesk-Signature  "sha256=" + lowercase hex of HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * A signature is only honoured within 5 minutes of its timestamp, so a captured request cannot be
 * replayed later. Fails CLOSED: if the secret is not configured, signed requests get 503 and nothing
 * is accepted.
 */

export const NEWSDESK_SIGNATURE_HEADER = 'X-Newsdesk-Signature';
export const NEWSDESK_TIMESTAMP_HEADER = 'X-Newsdesk-Timestamp';

/** Signed requests older (or newer) than this are refused. */
const MAX_CLOCK_SKEW_SECONDS = 300;
/** A Newsdesk story is text plus a hero image URL; anything bigger is not from the Newsdesk. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function isIngestPath(request: Request): boolean {
  return new URL(request.url).pathname.replace(/\/+$/, '') === '/api/admin/ingest';
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two strings (length differences do not short-circuit). */
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

export async function signNewsdeskBody(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  return toHex(mac);
}

/** The Bot account that owns Newsdesk stories (created by migration 0002). */
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

export type NewsdeskAuthResult =
  | { applies: false }
  | { applies: true; errorResponse: Response }
  | { applies: true; user: User; rawBody: string };

/**
 * Looks at a request to /api/admin/ingest.
 *  - No Newsdesk signature header: { applies: false }. The request carries on to the normal Cloudflare
 *    Access checks, exactly as before.
 *  - Signature header present: the request must verify, or it is refused here. Cloudflare Access login is
 *    not consulted for these requests (the shared secret is the credential).
 */
export async function authenticateNewsdeskRequest(request: Request, env: Env): Promise<NewsdeskAuthResult> {
  if (request.method !== 'POST' || !isIngestPath(request)) return { applies: false };
  const signatureHeader = request.headers.get(NEWSDESK_SIGNATURE_HEADER);
  if (signatureHeader === null) return { applies: false };

  const secret = env.NEWSDESK_INGEST_SECRET;
  if (!secret || secret.length < 16) {
    console.error('NEWSDESK_INGEST_SECRET is not configured; refusing Newsdesk ingest.');
    return { applies: true, errorResponse: jsonError('Newsdesk ingest is not configured on this server', 503) };
  }

  const timestamp = (request.headers.get(NEWSDESK_TIMESTAMP_HEADER) || '').trim();
  if (!/^\d{9,12}$/.test(timestamp)) {
    return { applies: true, errorResponse: jsonError('Unauthorized: missing or invalid timestamp', 401) };
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (skew > MAX_CLOCK_SKEW_SECONDS) {
    return { applies: true, errorResponse: jsonError('Unauthorized: request timestamp is outside the allowed window', 401) };
  }

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { applies: true, errorResponse: jsonError('Request body too large', 413) };
  }
  // Read a copy so the handler can still read the original request.
  const rawBody = await request.clone().text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return { applies: true, errorResponse: jsonError('Request body too large', 413) };
  }

  const provided = signatureHeader.trim().toLowerCase().replace(/^sha256=/, '');
  const expected = await signNewsdeskBody(secret, timestamp, rawBody);
  if (!timingSafeEqual(provided, expected)) {
    return { applies: true, errorResponse: jsonError('Unauthorized: invalid signature', 401) };
  }

  const user = await loadBotUser(env);
  if (!user) {
    return { applies: true, errorResponse: jsonError('Bot user is not configured in the database', 500) };
  }
  return { applies: true, user, rawBody };
}
