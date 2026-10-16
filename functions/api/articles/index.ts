import { Env, EventContext, ArticleRecord } from '../../types';

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const category = url.searchParams.get('category');
    const area = url.searchParams.get('area');
    const featured = url.searchParams.get('featured');
    const breaking = url.searchParams.get('breaking');
    const search = url.searchParams.get('search');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.id, a.slug, a.title, a.standfirst, a.category, a.area, 
        a.hero_image, a.image_caption, a.photo_credit, a.status, a.is_breaking, a.is_featured, 
        a.tags, a.seo_title, a.meta_description, a.published_at, a.created_at,
        u.name AS author_name, u.role AS author_role, u.photo AS author_photo,
        c.name AS category_name
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category = c.slug
      WHERE a.status = 'published' AND datetime(a.published_at) <= datetime('now')
    `;
    const params: any[] = [];

    if (category && category !== 'all') {
      query += ' AND a.category = ?';
      params.push(category);
    }

    if (area && area !== 'All Glasgow') {
      query += ' AND a.area = ?';
      params.push(area);
    }

    if (featured === 'true' || featured === '1') {
      query += ' AND a.is_featured = 1';
    }

    if (breaking === 'true' || breaking === '1') {
      query += ' AND a.is_breaking = 1';
    }

    if (search && search.trim()) {
      const sanitizedSearch = search.trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query += " AND (a.title LIKE ? ESCAPE '\\' OR a.standfirst LIKE ? ESCAPE '\\' OR a.body LIKE ? ESCAPE '\\' OR a.tags LIKE ? ESCAPE '\\')";
      const term = `%${sanitizedSearch}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = context.env.DB.prepare(query);
    const { results } = await stmt.bind(...params).all<ArticleRecord>();

    return new Response(JSON.stringify({ articles: results, page, limit }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (err: any) {
    console.error('Error fetching articles:', err);
    return new Response(JSON.stringify({ error: 'Failed to retrieve articles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
