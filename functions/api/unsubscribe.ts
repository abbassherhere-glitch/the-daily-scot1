import { Env, EventContext } from '../types';

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title} - The Daily Scot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #faf9f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 480px; padding: 32px; text-align: center; }
    h1 { color: #002b49; font-size: 24px; margin: 0 0 12px; }
    p { color: #4b5563; font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
    a, button { display: inline-block; background: #002b49; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; border: 0; font-size: 15px; cursor: pointer; }
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function readParams(request: Request): Promise<{ email: string; token: string }> {
  const url = new URL(request.url);
  let email = url.searchParams.get('email') || '';
  let token = url.searchParams.get('token') || '';
  if (request.method === 'POST') {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await request.formData();
      email = String(form.get('email') || email);
      token = String(form.get('token') || token);
    }
  }
  return { email: email.trim().toLowerCase(), token: token.trim() };
}

/**
 * GET /api/unsubscribe?email=...&token=...
 * Shows a confirmation button (a GET never unsubscribes, so email link scanners can't trigger it).
 */
export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  const { email, token } = await readParams(context.request);
  if (!email || !token) {
    return page('Unsubscribe', '<h1>Invalid link</h1><p>This unsubscribe link is incomplete.</p><a href="/">Return to The Daily Scot</a>', 400);
  }
  return page(
    'Unsubscribe',
    `<h1>Unsubscribe</h1>
     <p>Stop sending The Daily Scot Morning Briefing to <strong>${escapeAttr(email)}</strong>?</p>
     <form method="POST" action="/api/unsubscribe">
       <input type="hidden" name="email" value="${escapeAttr(email)}" />
       <input type="hidden" name="token" value="${escapeAttr(token)}" />
       <button type="submit">Unsubscribe</button>
     </form>`
  );
}

/**
 * POST /api/unsubscribe
 * Handles the confirmation form and RFC 8058 one-click unsubscribe (List-Unsubscribe-Post).
 * Removes the subscriber record entirely (data minimisation under UK GDPR).
 */
export async function onRequestPost(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const { email, token } = await readParams(context.request);
    if (email && token) {
      await context.env.DB.prepare('DELETE FROM newsletter_subscribers WHERE email = ? AND unsubscribe_token = ?')
        .bind(email, token)
        .run();
    }
    // Same response whether or not the address existed, so the endpoint can't be used to probe subscribers
    return page(
      'Unsubscribed',
      '<h1>You have been unsubscribed</h1><p>You will no longer receive the Morning Briefing.</p><a href="/">Return to The Daily Scot</a>'
    );
  } catch (err) {
    console.error('Unsubscribe failed:', err);
    return page('Error', '<h1>Something went wrong</h1><p>Please try again later.</p>', 500);
  }
}
