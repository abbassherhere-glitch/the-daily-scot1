import { Env, EventContext } from '../types';

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const query = `
      SELECT 
        id, slug, title, standfirst, category, area, published_at, breaking_until
      FROM articles
      WHERE is_breaking = 1
        AND status = 'published'
        AND datetime(published_at) <= datetime('now')
        AND (breaking_until IS NULL OR datetime(breaking_until) > datetime('now'))
      ORDER BY published_at DESC
      LIMIT 5
    `;

    const { results } = await context.env.DB.prepare(query).all();

    return new Response(JSON.stringify({ articles: results || [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (err: any) {
    console.error('Breaking news fetch failed:', err);
    return new Response(JSON.stringify({ articles: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
