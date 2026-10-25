import { Env, EventContext, User } from '../../types';
import { authenticateAdminRequest } from '../../utils/auth';
import { authenticateNewsdeskRequest } from '../../utils/newsdeskAuth';

export async function onRequest(
  context: EventContext<Env, any, { user?: User; newsdeskBody?: string }>
): Promise<Response> {
  // Reject preflight CORS OPTIONS requests immediately
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 405 });
  }

  // Reject admin POST/PUT/DELETE whose Origin header is not the admin domain
  const method = context.request.method.toUpperCase();
  const origin = context.request.headers.get('Origin');
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (origin) {
      try {
        const requestUrl = new URL(context.request.url);
        // Browser origin must match the admin domain origin
        if (origin !== requestUrl.origin) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cross-origin admin requests are strictly rejected' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Invalid request origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // The AI Newsdesk signs its calls to /api/admin/ingest with a shared secret (NEWSDESK_INGEST_SECRET)
  // instead of signing in through Cloudflare Access. A request without a Newsdesk signature header is
  // not affected and goes through the Access checks below exactly as before.
  const newsdesk = await authenticateNewsdeskRequest(context.request, context.env);
  if (newsdesk.applies) {
    if ('errorResponse' in newsdesk) return newsdesk.errorResponse;
    context.data.user = newsdesk.user;
    context.data.newsdeskBody = newsdesk.rawBody;
  } else {
    const auth = await authenticateAdminRequest(context.request, context.env);
    if (auth.errorResponse || !auth.user) {
      return auth.errorResponse || new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    context.data.user = auth.user;
  }

  const response = await context.next();

  // Strict headers: No CORS headers (same-origin only), no caching, no indexing
  const headers = new Headers(response.headers);
  headers.delete('Access-Control-Allow-Origin');
  headers.delete('Access-Control-Allow-Methods');
  headers.delete('Access-Control-Allow-Headers');
  headers.delete('Access-Control-Allow-Credentials');

  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
