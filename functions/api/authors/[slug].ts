import { Env, EventContext } from '../../types';
import { BYLINE_JOIN, BYLINE_SELECT, BYLINE_SLUG_MATCH } from '../../utils/byline';
import { getAuthorProfile, isValidAuthorSlug, PUBLISHED_SQL } from '../../utils/authors';

/** GET /api/authors/<slug>?page=1&limit=12 – author profile plus their published stories, newest first. */
export async function onRequestGet(context: EventContext<Env, 'slug', any>): Promise<Response> {
  try {
    const slug = String(context.params.slug || '').toLowerCase();
    if (!isValidAuthorSlug(slug)) {
      return json({ error: 'Author not found' }, 404, 'public, max-age=60');
    }

    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10) || 12));
    const offset = (page - 1) * limit;

    const profile = await getAuthorProfile(context.env, slug);
    if (!profile) {
      return json({ error: 'Author not found' }, 404, 'public, max-age=60');
    }

    const { results } = await context.env.DB.prepare(`
        SELECT
          a.id, a.slug, a.title, a.standfirst, a.category, a.area,
          a.hero_image, a.image_caption, a.photo_credit, a.status, a.is_breaking, a.is_featured,
          a.tags, a.seo_title, a.meta_description, a.published_at, a.created_at,
          ${BYLINE_SELECT},
          c.name AS category_name
        FROM articles a
        ${BYLINE_JOIN}
        LEFT JOIN categories c ON a.category = c.slug
        WHERE ${PUBLISHED_SQL} AND ${BYLINE_SLUG_MATCH}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(slug, slug, limit, offset)
      .all();

    return json(
      {
        author: profile.author,
        articles: results || [],
        page,
        limit,
        total: profile.total,
        total_pages: Math.max(1, Math.ceil(profile.total / limit)),
      },
      200,
      'public, max-age=60, s-maxage=300'
    );
  } catch (err) {
    console.error('Author page fetch failed:', err);
    return json({ error: 'Failed to retrieve author' }, 500);
  }
}

function json(data: unknown, status: number, cacheControl?: string): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cacheControl) headers['Cache-Control'] = cacheControl;
  return new Response(JSON.stringify(data), { status, headers });
}
