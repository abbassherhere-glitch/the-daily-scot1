import { Env, EventContext } from '../types';

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const xForwarded = request.headers.get('x-forwarded-for');
  if (xForwarded) return xForwarded.split(',')[0].trim();
  const xReal = request.headers.get('x-real-ip');
  if (xReal) return xReal.trim();
  return '127.0.0.1';
}

/**
 * Check and enforce rate limiting per key (e.g. per IP)
 */
async function checkRateLimit(
  db: Env['DB'],
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const existing = await db
      .prepare('SELECT count, expires_at FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ count: number; expires_at: number }>();

    if (!existing || existing.expires_at < now) {
      await db
        .prepare('INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)')
        .bind(key, now + windowSeconds)
        .run();
      return true;
    }

    if (existing.count >= limit) {
      return false;
    }

    await db
      .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
      .bind(key)
      .run();
    return true;
  } catch (err) {
    console.warn('Rate limit check exception:', err);
    // Allow through if table is missing or transient error
    return true;
  }
}

/**
 * Verify Cloudflare Turnstile token server-side
 */
async function verifyTurnstile(
  secretKey: string | undefined,
  token: string | undefined,
  ip: string
): Promise<{ success: boolean; error?: string }> {
  if (!secretKey) {
    // Not configured: allow (rate limiting still applies) but make it visible in logs.
    console.warn('[Newsletter] TURNSTILE_SECRET not set – signup spam protection is disabled');
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Turnstile verification token missing' };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (!outcome.success) {
      return { success: false, error: 'Turnstile verification failed' };
    }

    return { success: true };
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return { success: false, error: 'Unable to verify Turnstile' };
  }
}

/**
 * GET /api/newsletter?token=...&email=...
 * Confirms double opt-in subscription
 */
export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email')?.trim().toLowerCase();

    if (!token || !email) {
      return new Response('Invalid verification request.', { status: 400 });
    }

    const subscriber = await context.env.DB
      .prepare('SELECT email, confirmed, token FROM newsletter_subscribers WHERE email = ?')
      .bind(email)
      .first<{ email: string; confirmed: number; token: string }>();

    if (!subscriber || subscriber.token !== token) {
      return new Response(
        '<html><body><h1>Verification Failed</h1><p>Invalid or expired verification link.</p></body></html>',
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    await context.env.DB
      .prepare('UPDATE newsletter_subscribers SET confirmed = 1, token = NULL WHERE email = ?')
      .bind(email)
      .run();

    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Subscription Confirmed - The Daily Scot</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #faf9f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 480px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
    h1 { color: #002b49; font-size: 24px; margin-bottom: 12px; }
    p { color: #4b5563; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
    a { display: inline-block; background: #002b49; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Subscription Confirmed</h1>
    <p>Thank you for subscribing to <strong>The Daily Scot Morning Briefing</strong>. Your email has been verified.</p>
    <a href="/">Return to The Daily Scot</a>
  </div>
</body>
</html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    console.error('Newsletter verification error:', err);
    return new Response('Internal error during verification.', { status: 500 });
  }
}

/**
 * POST /api/newsletter
 * Subscribes user with rate limiting, Turnstile verification, and double opt-in
 */
export async function onRequestPost(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const ip = getClientIp(context.request);

    // 1. Rate limit per IP: max 5 attempts per 10 minutes (600s)
    const allowed = await checkRateLimit(context.env.DB, `rate:nl:${ip}`, 5, 600);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait a few minutes before trying again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json() as { email?: string; turnstile_token?: string };
    const email = body?.email?.trim().toLowerCase().slice(0, 254);

    // 2. Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Valid email address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Server-side Cloudflare Turnstile verification
    const turnstileResult = await verifyTurnstile(
      context.env.TURNSTILE_SECRET,
      body?.turnstile_token,
      ip
    );
    if (!turnstileResult.success) {
      return new Response(
        JSON.stringify({ error: turnstileResult.error || 'Turnstile verification failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Double opt-in: generate confirmation token (and a permanent unsubscribe token on first signup)
    const token = crypto.randomUUID();
    const unsubscribeToken = crypto.randomUUID();

    await context.env.DB.prepare(
      `INSERT INTO newsletter_subscribers (email, confirmed, token, unsubscribe_token, created_at)
       VALUES (?, 0, ?, ?, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET
         token = CASE WHEN newsletter_subscribers.confirmed = 1 THEN NULL ELSE excluded.token END,
         unsubscribe_token = COALESCE(newsletter_subscribers.unsubscribe_token, excluded.unsubscribe_token)`
    )
      .bind(email, token, unsubscribeToken)
      .run();

    const subscriber = await context.env.DB.prepare(
      'SELECT confirmed, token, unsubscribe_token FROM newsletter_subscribers WHERE email = ?'
    )
      .bind(email)
      .first<{ confirmed: number; token: string | null; unsubscribe_token: string | null }>();

    // Already confirmed: don't send another email, but don't reveal subscription status either
    if (subscriber && subscriber.confirmed === 1) {
      return new Response(
        JSON.stringify({ success: true, message: 'Please check your email to confirm your subscription.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Send double opt-in confirmation email via Resend if API key is present
    const siteUrl = (context.env.SITE_URL || new URL(context.request.url).origin).replace(/\/+$/, '');
    const encodedEmail = encodeURIComponent(email);
    const confirmLink = `${siteUrl}/api/newsletter?token=${subscriber?.token || token}&email=${encodedEmail}`;
    const unsubscribeLink = `${siteUrl}/api/unsubscribe?token=${subscriber?.unsubscribe_token || unsubscribeToken}&email=${encodedEmail}`;

    if (context.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: context.env.NEWSLETTER_FROM || 'The Daily Scot <newsletter@thedailyscot.co.uk>',
            to: [email],
            subject: 'Confirm your subscription to The Daily Scot',
            headers: {
              'List-Unsubscribe': `<${unsubscribeLink}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            html:
              `<p>Please confirm your subscription to The Daily Scot Morning Briefing by clicking the link below:</p>` +
              `<p><a href="${confirmLink}">Confirm Subscription</a></p>` +
              `<p style="font-size:12px;color:#666">If you did not request this, ignore this email or ` +
              `<a href="${unsubscribeLink}">remove your address</a>.</p>`,
          }),
        });
        if (!res.ok) {
          console.error('Resend rejected confirmation email:', res.status, await res.text());
          return new Response(
            JSON.stringify({ error: 'We could not send the confirmation email. Please try again later.' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('Failed to send verification email via Resend:', e);
        return new Response(
          JSON.stringify({ error: 'We could not send the confirmation email. Please try again later.' }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Configure RESEND_API_KEY via `wrangler pages secret put RESEND_API_KEY` for production email
      console.warn(`[Newsletter] RESEND_API_KEY not set – confirmation link for ${email}: ${confirmLink}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Please check your email to confirm your subscription.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Newsletter signup error:', err);
    return new Response(JSON.stringify({ error: 'Unable to register subscription' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
