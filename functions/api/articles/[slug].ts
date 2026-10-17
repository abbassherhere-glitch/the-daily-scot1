import { Env, EventContext, ArticleRecord } from '../../types';
import { sanitizeHtml } from '../../utils/sanitize';
import { BYLINE_JOIN, BYLINE_SELECT } from '../../utils/byline';

export async function onRequestGet(context: EventContext<Env, 'slug', any>): Promise<Response> {
  try {
    const slug = context.params.slug as string;
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const query = `
      SELECT 
        a.id, a.slug, a.title, a.standfirst, a.body, a.category, a.area, 
        a.hero_image, a.image_caption, a.photo_credit, a.status, a.is_breaking, a.is_featured, 
        a.tags, a.seo_title, a.meta_description, a.published_at, a.created_at, a.updated_at,
        ${BYLINE_SELECT},
        CASE WHEN a.byline_user_id IS NOT NULL THEN bu.bio ELSE NULL END AS author_bio,
        c.name AS category_name
      FROM articles a
      ${BYLINE_JOIN}
      LEFT JOIN categories c ON a.category = c.slug
      WHERE a.slug = ? AND a.status = 'published' AND datetime(a.published_at) <= datetime('now')
      LIMIT 1
    `;

    const article = await context.env.DB.prepare(query)
      .bind(slug)
      .first<ArticleRecord>();

    if (!article) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure body HTML is sanitized
    article.body = await sanitizeHtml(article.body);

    return new Response(JSON.stringify({ article }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=600',
      },
    });
  } catch (err: any) {
    console.error('Error fetching article by slug:', err);
    return new Response(JSON.stringify({ error: 'Failed to retrieve article' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
