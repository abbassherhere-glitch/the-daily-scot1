/**
 * Search-engine helpers for the public site.
 *
 * The public site is a React single-page app: index.html ships an empty <div id="root"></div>
 * and the stories only appear after JavaScript runs. Google can run JavaScript, but it does so
 * later and less reliably, and many crawlers (Bing, social previews, Google News at first fetch)
 * never do. These helpers let Pages Functions put real, readable HTML (headlines, links, story
 * text) inside #root on the server. React's createRoot() replaces it as soon as the app loads,
 * so readers see no difference.
 */

export const SITE_NAME = 'The Daily Scot';
/** Other names people type when looking for the site; helps Google show the right site name. */
export const SITE_ALTERNATE_NAMES = ['Daily Scot', 'TheDailyScot', 'The Daily Scot Glasgow', 'thedailyscot.co.uk'];
export const SITE_DESCRIPTION =
  "The Daily Scot is an independent Glasgow and Scotland news website: breaking news, council, courts, transport, property, Celtic and Rangers, and what's on.";

/**
 * Official profiles of The Daily Scot on other sites (Facebook, Instagram, X, LinkedIn...).
 * Add the full https:// links here once the accounts exist. Google uses them to understand
 * which "Daily Scot" is this website.
 */
export const SAME_AS: string[] = [];

export function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeText(value: string): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function safeJsonForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** D1 'YYYY-MM-DD HH:MM:SS' (UTC) -> ISO 8601 */
export function toIso(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function humanDate(value?: string): string {
  const iso = toIso(value);
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}

/** The publisher, as structured data. */
export function publisherLd(origin: string) {
  return {
    '@type': 'NewsMediaOrganization',
    '@id': `${origin}/#organization`,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${origin}/`,
    logo: { '@type': 'ImageObject', url: `${origin}/icon-512.png`, width: 512, height: 512 },
    areaServed: [
      { '@type': 'City', name: 'Glasgow' },
      { '@type': 'Country', name: 'Scotland' },
    ],
    ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
  };
}

/** Site-wide structured data for the homepage: who we are + the site's name. */
export function siteJsonLd(origin: string): string {
  return safeJsonForScript({
    '@context': 'https://schema.org',
    '@graph': [
      publisherLd(origin),
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: `${origin}/`,
        description: SITE_DESCRIPTION,
        inLanguage: 'en-GB',
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  });
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url })),
  };
}

export interface HeadlineRow {
  slug: string;
  title: string;
  standfirst?: string;
  category?: string;
  category_name?: string;
  published_at?: string;
}

/** A plain list of story links, used as the server-rendered content of the homepage and section pages. */
export function headlineListHtml(rows: HeadlineRow[]): string {
  return rows
    .map(
      (r) =>
        `<li><article><h2><a href="/news/${encodeURIComponent(r.slug)}">${escapeText(r.title)}</a></h2>` +
        (r.standfirst ? `<p>${escapeText(r.standfirst)}</p>` : '') +
        (r.published_at ? `<time datetime="${escapeAttr(toIso(r.published_at) || '')}">${escapeText(humanDate(r.published_at))}</time>` : '') +
        `</article></li>`,
    )
    .join('');
}

export interface SectionLink {
  slug: string;
  name: string;
}

export function sectionNavHtml(sections: SectionLink[]): string {
  if (!sections.length) return '';
  return (
    '<nav aria-label="Sections"><ul>' +
    sections.map((s) => `<li><a href="/news/${encodeURIComponent(s.slug)}">${escapeText(s.name)}</a></li>`).join('') +
    '</ul></nav>'
  );
}

/** Shared SQL for "latest published stories". */
export const LATEST_SQL = `
  SELECT a.slug, a.title, a.standfirst, a.category, a.published_at, c.name AS category_name
  FROM articles a
  LEFT JOIN categories c ON a.category = c.slug
  WHERE a.status = 'published' AND datetime(a.published_at) <= datetime('now')`;
