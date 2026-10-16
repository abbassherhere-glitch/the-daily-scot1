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
 * GET /api/views?type=most-read
 * Returns top most-read published articles calculated from real page_views table
 */
export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const query = `
      SELECT 
        a.id, a.slug, a.title, a.standfirst, a.category, a.area,
        a.hero_image, a.published_at,
        COALESCE(SUM(pv.count), 0) AS total_views
      FROM articles a
      JOIN page_views pv ON a.id = pv.article_id
      WHERE a.status = 'published' AND a.published_at <= datetime('now')
      GROUP BY a.id
      ORDER BY total_views DESC
      LIMIT 5
    `;

    const { results } = await context.env.DB.prepare(query).all();

    return new Response(JSON.stringify({ mostRead: results || [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=300',
      },
    });
  } catch (err: any) {
    console.error('Most read query failed:', err);
    return new Response(JSON.stringify({ mostRead: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/views
 * Increments page view count for an article, strictly rate limited per IP per article
 */
export async function onRequestPost(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const ip = getClientIp(context.request);
    const body = await context.request.json() as { article_id?: string; slug?: string };

    let articleId = body.article_id;

    if (!articleId && body.slug) {
      const art = await context.env.DB
        .prepare("SELECT id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1")
        .bind(body.slug)
        .first<{ id: string }>();
      if (art) {
        articleId = art.id;
      }
    }

    if (!articleId) {
      return new Response(JSON.stringify({ error: 'Valid article_id or slug required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limit per IP per article: 1 count per 10 minutes (600s)
    const rateLimitKey = `rate:pv:${articleId}:${ip}`;
    const now = Math.floor(Date.now() / 1000);

    const existingRate = await context.env.DB
      .prepare('SELECT expires_at FROM rate_limits WHERE key = ?')
      .bind(rateLimitKey)
      .first<{ expires_at: number }>();

    if (existingRate && existingRate.expires_at > now) {
      // Already counted recently for this IP and article
      return new Response(JSON.stringify({ recorded: false, reason: 'rate_limited' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Record rate limit for this IP and article
    await context.env.DB
      .prepare('INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)')
      .bind(rateLimitKey, now + 600)
      .run();

    // Increment page_views in D1 table
    await context.env.DB
      .prepare(`
        INSERT INTO page_views (article_id, day, count)
        VALUES (?, date('now'), 1)
        ON CONFLICT(article_id, day) DO UPDATE SET count = count + 1
      `)
      .bind(articleId)
      .run();

    return new Response(JSON.stringify({ recorded: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Page view increment failed:', err);
    return new Response(JSON.stringify({ recorded: false, error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
