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
      WHERE a.status = 'published' AND datetime(a.published_at) <= datetime('now')
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
 * Increments the daily page-view count for an article.
 * De-duplicates per IP per article for 10 minutes using the edge Cache API (free, no D1 writes),
 * so each counted view costs exactly ONE D1 write (D1 free tier: 100k writes/day).
 */
export async function onRequestPost(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const ip = getClientIp(context.request);
    const body = (await context.request.json().catch(() => ({}))) as { article_id?: string; slug?: string };

    const slug = typeof body.slug === 'string' ? body.slug.slice(0, 120) : '';
    const articleIdInput = typeof body.article_id === 'string' ? body.article_id.slice(0, 80) : '';
    if (!slug && !articleIdInput) {
      return new Response(JSON.stringify({ error: 'Valid article_id or slug required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Dedupe key (IP is hashed so it never leaves this function in clear text)
    const ipHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`pv:${ip}`)))
    )
      .slice(0, 12)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const dedupeKey = new Request(
      `https://pv-dedupe.internal/${encodeURIComponent(slug || articleIdInput)}/${ipHash}`
    );
    // @ts-ignore - caches.default is provided by the Workers runtime
    const cache: Cache | undefined = typeof caches !== 'undefined' ? (caches as any).default : undefined;

    if (cache && (await cache.match(dedupeKey))) {
      return new Response(JSON.stringify({ recorded: false, reason: 'rate_limited' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Single write: only counts views for real, live articles
    const result = await context.env.DB.prepare(`
        INSERT INTO page_views (article_id, day, count)
        SELECT id, date('now'), 1 FROM articles
        WHERE (slug = ? OR id = ?) AND status = 'published' AND datetime(published_at) <= datetime('now')
        LIMIT 1
        ON CONFLICT(article_id, day) DO UPDATE SET count = count + 1
      `)
      .bind(slug, articleIdInput)
      .run();

    if (cache) {
      context.waitUntil(
        cache.put(dedupeKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
      );
    }

    const recorded = Boolean((result as any)?.meta?.changes);
    return new Response(JSON.stringify({ recorded }), {
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
