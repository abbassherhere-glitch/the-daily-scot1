import { Env, EventContext } from './types';

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const domain = url.origin;

    const { results: articles } = await context.env.DB.prepare(
      "SELECT slug, category, updated_at FROM articles WHERE status = 'published' AND published_at <= datetime('now') ORDER BY published_at DESC LIMIT 1000"
    ).all<{ slug: string; category: string; updated_at: string }>();

    const categories = ['news', 'glasgow', 'scotland', 'politics', 'business', 'property', 'sport', 'whats-on', 'opinion'];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += `  <url>\n    <loc>${domain}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Category pages
    categories.forEach((cat) => {
      xml += `  <url>\n    <loc>${domain}/news/${cat}</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    // Articles
    articles.forEach((art) => {
      const loc = `${domain}/news/${encodeURIComponent(art.slug)}`;
      const lastmod = art.updated_at ? new Date(art.updated_at).toISOString() : new Date().toISOString();
      xml += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    xml += '</urlset>';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=14400',
      },
    });
  } catch (e: any) {
    return new Response('Error generating sitemap', { status: 500 });
  }
}
