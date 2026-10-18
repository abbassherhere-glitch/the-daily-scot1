import { Env, EventContext } from './types';
import { BYLINE_JOIN, BYLINE_SELECT } from './utils/byline';
import { SITE_DESCRIPTION, siteOrigin, toIso } from './utils/seo';

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const domain = siteOrigin(context.env);

    const { results: articles } = await context.env.DB.prepare(`
      SELECT a.slug, a.title, a.standfirst, a.category, a.published_at, ${BYLINE_SELECT}
      FROM articles a
      ${BYLINE_JOIN}
      WHERE a.status = 'published' AND datetime(a.published_at) <= datetime('now')
      ORDER BY a.published_at DESC
      LIMIT 50
    `).all<{
      slug: string;
      title: string;
      standfirst: string;
      category: string;
      published_at: string;
      author_name: string;
    }>();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n';
    xml += '  <channel>\n';
    xml += '    <title>The Daily Scot | Glasgow &amp; Scotland News</title>\n';
    xml += `    <link>${domain}</link>\n`;
    xml += `    <description>${escapeXml(SITE_DESCRIPTION)}</description>\n`;
    xml += '    <language>en-gb</language>\n';
    // The newest story's date, so the feed only looks "changed" when it has
    const newest = articles[0]?.published_at ? toIso(articles[0].published_at) : undefined;
    xml += `    <lastBuildDate>${(newest ? new Date(newest) : new Date()).toUTCString()}</lastBuildDate>\n`;
    xml += `    <image>\n      <url>${domain}/icon-512.png</url>\n      <title>The Daily Scot</title>\n      <link>${domain}</link>\n    </image>\n`;
    xml += `    <atom:link href="${domain}/rss.xml" rel="self" type="application/rss+xml" />\n`;

    articles.forEach((art) => {
      const link = `${domain}/news/${encodeURIComponent(art.slug)}`;
      const iso = toIso(art.published_at);
      const pubDate = (iso ? new Date(iso) : new Date()).toUTCString();

      xml += '    <item>\n';
      xml += `      <title>${escapeXml(art.title)}</title>\n`;
      xml += `      <link>${link}</link>\n`;
      xml += `      <guid isPermaLink="true">${link}</guid>\n`;
      xml += `      <description>${escapeXml(art.standfirst)}</description>\n`;
      xml += `      <pubDate>${pubDate}</pubDate>\n`;
      xml += `      <category>${escapeXml(art.category)}</category>\n`;
      if (art.author_name) {
        xml += `      <dc:creator>${escapeXml(art.author_name)}</dc:creator>\n`;
      }
      xml += '    </item>\n';
    });

    xml += '  </channel>\n';
    xml += '</rss>';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=7200',
      },
    });
  } catch (e: any) {
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
