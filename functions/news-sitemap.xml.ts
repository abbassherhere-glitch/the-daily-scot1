import { Env, EventContext } from './types';
import { siteOrigin, toIso } from './utils/seo';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const domain = siteOrigin(context.env);

    const { results: articles } = await context.env.DB.prepare(
      `SELECT slug, title, category, published_at 
       FROM articles 
       WHERE status = 'published' 
         AND datetime(published_at) <= datetime('now') 
         AND datetime(published_at) >= datetime('now', '-48 hours')
       ORDER BY published_at DESC 
       LIMIT 1000`
    ).all<{ slug: string; title: string; category: string; published_at: string }>();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

    articles.forEach((art) => {
      const loc = `${domain}/news/${encodeURIComponent(art.slug)}`;
      const pubDate = toIso(art.published_at) || new Date().toISOString();
      xml += '  <url>\n';
      xml += `    <loc>${loc}</loc>\n`;
      xml += '    <news:news>\n';
      xml += '      <news:publication>\n';
      xml += '        <news:name>The Daily Scot</news:name>\n';
      xml += '        <news:language>en</news:language>\n';
      xml += '      </news:publication>\n';
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
      xml += `      <news:title>${escapeXml(art.title)}</news:title>\n`;
      xml += '    </news:news>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=7200',
      },
    });
  } catch (e: any) {
    return new Response('Error generating news sitemap', { status: 500 });
  }
}
