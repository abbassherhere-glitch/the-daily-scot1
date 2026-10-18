import { Env, EventContext } from './types';
import { STAFF_BYLINE_SLUG } from './utils/byline';
import { INFO_PAGES, infoPageIndexable } from '../src/config/infoPages';
import { safeImageUrl, siteOrigin, toIso } from './utils/seo';

/**
 * Google reads up to 50,000 addresses per sitemap. If the site ever outgrows this, split the stories
 * into several sitemaps listed by a sitemap index instead of raising the number.
 */
const MAX_STORIES = 5000;

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
    const db = context.env.DB;

    const [{ results: articles }, { results: categories }, { results: sectionDates }, { results: authors }] = await Promise.all([
      db
        .prepare(
          `SELECT slug, hero_image, updated_at FROM articles
           WHERE status = 'published' AND datetime(published_at) <= datetime('now')
           ORDER BY published_at DESC LIMIT ?`,
        )
        .bind(MAX_STORIES)
        .all<{ slug: string; hero_image: string | null; updated_at: string }>(),
      db.prepare('SELECT slug FROM categories ORDER BY sort_order').all<{ slug: string }>(),
      // When each section last changed, so <lastmod> is true rather than "now"
      db
        .prepare(
          `SELECT category, MAX(updated_at) AS updated_at FROM articles
           WHERE status = 'published' AND datetime(published_at) <= datetime('now')
           GROUP BY category`,
        )
        .all<{ category: string; updated_at: string }>(),
      // Author pages: every byline with at least one published story
      db
        .prepare(
          `SELECT COALESCE(NULLIF(byline_slug, ''), '${STAFF_BYLINE_SLUG}') AS slug, MAX(updated_at) AS updated_at
           FROM articles
           WHERE status = 'published' AND datetime(published_at) <= datetime('now')
           GROUP BY 1
           LIMIT 500`,
        )
        .all<{ slug: string; updated_at: string }>(),
    ]);

    const sectionUpdated = new Map(sectionDates.map((r) => [r.category, toIso(r.updated_at)]));
    const homeUpdated = [...sectionUpdated.values()].filter(Boolean).sort().pop();

    const entry = (loc: string, lastmod?: string, extra = '') =>
      `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}${extra}  </url>\n`;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml +=
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    xml += entry(`${domain}/`, homeUpdated);
    categories.forEach((cat) => {
      xml += entry(`${domain}/news/${encodeURIComponent(cat.slug)}`, sectionUpdated.get(cat.slug));
    });
    // Company / legal pages: listed once the details they depend on are real (until then they are noindex)
    INFO_PAGES.filter(infoPageIndexable).forEach((page) => (xml += entry(`${domain}${page.path}`)));
    authors.forEach((author) => {
      xml += entry(`${domain}/author/${encodeURIComponent(author.slug)}`, toIso(author.updated_at));
    });
    articles.forEach((art) => {
      const image = safeImageUrl(art.hero_image, domain);
      xml += entry(
        `${domain}/news/${encodeURIComponent(art.slug)}`,
        toIso(art.updated_at),
        image ? `    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>\n` : '',
      );
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
