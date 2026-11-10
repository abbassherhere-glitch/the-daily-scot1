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

import { SITE_NAME, SITE_DESCRIPTION, HOME_TITLE, sectionSeo, sectionHeading, withBrand } from '../../src/config/seoText';

export { SITE_NAME, SITE_DESCRIPTION, HOME_TITLE, sectionSeo, sectionHeading, withBrand };
export { splitKeyFacts, storyQuestions, markQuestionHeadings } from '../../src/config/storyBlocks';

/** Other names people type when looking for the site; helps Google show the right site name. */
export const SITE_ALTERNATE_NAMES = ['Daily Scot', 'TheDailyScot', 'The Daily Scot Glasgow', 'thedailyscot.co.uk'];

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
export function siteJsonLd(origin: string) {
  return {
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
  };
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

/**
 * A plain list of story links, used as the server-rendered content of the homepage and section pages.
 * `level` is the heading level of each headline (2 on pages whose <h1> is the page title, 3 under a
 * "More from..." sub-heading).
 */
export function headlineListHtml(rows: HeadlineRow[], level: 2 | 3 = 2): string {
  return rows
    .map(
      (r) =>
        `<li><article><h${level}><a href="/news/${encodeURIComponent(r.slug)}">${escapeText(r.title)}</a></h${level}>` +
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

// ---------------------------------------------------------------------------------------------
// Canonical address
// ---------------------------------------------------------------------------------------------

export const PRODUCTION_ORIGIN = 'https://thedailyscot.co.uk';

/**
 * The one address search engines should list for the site. Canonical links, og:url, sitemaps and
 * the RSS feed all use this instead of the address the request arrived on, so the *.pages.dev
 * address (and www., http:// and preview deployments) can never become a competing copy of the site.
 * Set SITE_URL (e.g. https://thedailyscot.co.uk) to override.
 */
export function siteOrigin(env: { SITE_URL?: string }): string {
  const configured = (env.SITE_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+$/i.test(configured) ? configured : PRODUCTION_ORIGIN;
}

/** Cloudflare's own addresses (*.pages.dev, *.workers.dev) are copies of the site and must stay out of Google. */
export function isStagingHost(hostname: string): boolean {
  return /\.(pages|workers)\.dev$/i.test(hostname);
}

// ---------------------------------------------------------------------------------------------
// Story text
// ---------------------------------------------------------------------------------------------

/**
 * Split a stored story body into blocks. Mirrors parseBodyToBlocks() in src/services/api.ts so the
 * server-rendered text matches what the app shows: bodies are either HTML, or plain text with blank
 * lines between paragraphs.
 */
export function bodyToHtml(body: string): string {
  if (!body) return '';
  if (/<(p|h2|h3|blockquote|ul|ol|figure)[^>]*>/i.test(body)) {
    const blocks = body.match(/<(p|h2|h3|blockquote|ul|ol|figure)[\s\S]*?<\/\1>/gi);
    if (blocks && blocks.length) return blocks.map((b) => b.trim()).join('\n');
  }
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('<') ? p : `<p>${escapeText(p)}</p>`))
    .join('\n');
}

/** Stored tags are a JSON array or a comma-separated string (see transformD1RowToArticle in the app). */
export function parseTags(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const list = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(',');
    return (Array.isArray(list) ? list : []).map((t) => String(t).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** First ~155 characters of a story as plain text, for when no description was written. */
export function plainExcerpt(html: string, max = 155): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/** Only absolute http(s) image URLs (or site-relative paths, made absolute) may go in meta tags. */
export function safeImageUrl(value: string | undefined | null, origin: string): string | null {
  if (!value) return null;
  const str = value.trim();
  if (str.startsWith('/') && !str.startsWith('//')) return `${origin}${str}`;
  try {
    const url = new URL(str);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Words in a story, for structured data. */
export function wordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------------------------
// Putting a page together
// ---------------------------------------------------------------------------------------------

/**
 * Styles for the server-rendered content, which is visible until the app loads and replaces it. The app's
 * stylesheet resets lists, links and headings to plain text, so without this the page would look like an
 * unformatted text dump on a slow connection. Scoped to .ssr so it can never touch the app itself.
 */
const SSR_CSS = [
  '.ssr{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;line-height:1.5}',
  '.ssr a{color:inherit}',
  // Black bar with the logo, then the section links in white
  '.ssr header{background:#111}',
  '.ssr header>p{margin:0 auto;max-width:80rem;padding:.625rem 1rem}',
  '.ssr header>p a{display:inline-block}',
  '.ssr header img{display:block;height:2rem;width:auto}',
  '.ssr header nav{border-top:1px solid rgba(255,255,255,.25)}',
  '.ssr nav ul,.ssr nav ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap}',
  '.ssr header nav ul{max-width:80rem;margin:0 auto;padding:0 .25rem}',
  '.ssr header nav a{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 .625rem;color:#fff;font-weight:700;font-size:.8125rem;letter-spacing:.025em;text-transform:uppercase;text-decoration:none}',
  '.ssr main{max-width:80rem;margin:0 auto;padding:1rem}',
  '.ssr main nav ol{gap:.375rem;align-items:center;margin:0 0 .75rem}',
  // Small block labels: yellow for sections, white for areas
  '.ssr .lab{display:inline-block;background:#f7e14b;color:#111;font-size:.6875rem;line-height:1;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;padding:.25rem .5rem}',
  '.ssr .lab-w{background:#fff}',
  '.ssr .lab-k{background:#111;color:#fff}',
  '.ssr .lab-r{background:#c81e1e;color:#fff}',
  // Yellow banner (road closures page) and yellow promo panel (homepage)
  '.ssr .banner{background:#f7e14b;padding:1.25rem 1rem;margin:0 0 1rem}',
  '.ssr .banner h1,.ssr .banner h2{margin:0 0 .25rem}',
  '.ssr .banner time{color:#111;font-size:inherit;font-weight:700}',
  '.ssr .banner ul{list-style:square;margin:.5rem 0;padding-left:1.25rem}',
  '.ssr .banner a{font-weight:800}',
  '.ssr h1,.ssr h2,.ssr h3{font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;font-weight:800;letter-spacing:-.02em}',
  '.ssr h1{font-size:2rem;line-height:1.1;margin:.5rem 0;text-wrap:balance}',
  '.ssr h2,.ssr h3{font-size:1.25rem;line-height:1.2;margin:0}',
  '.ssr h2 a,.ssr h3 a{text-decoration:none}',
  // Headings on a yellow block sitting on a thick black rule
  '.ssr .hd{border-bottom:3px solid #111;margin:0 0 .5rem;text-transform:uppercase}',
  '.ssr .hd span{display:inline-block;background:#f7e14b;padding:.375rem .75rem}',
  '.ssr .list{list-style:none;margin:0;padding:0}',
  '.ssr .list>li{border-bottom:1px solid rgba(17,17,17,.16);padding:.8rem 0}',
  '.ssr p{margin:.35rem 0}',
  '.ssr time{font-size:.75rem;color:#595959}',
  // Story page: full-width photo, black headline panel overlapping it, byline rule, yellow key facts
  '.ssr .hero{margin:-1rem -1rem 0}',
  '.ssr .hero img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;background:#e8e8e3}',
  '.ssr .panel{position:relative;background:#111;color:#fff;margin:-2.5rem 0 0 -1rem;padding:1.25rem 1rem;max-width:56rem}',
  '.ssr .panel h1{margin:0}',
  '.ssr .panel p{color:#e5e5e5;font-size:1rem;line-height:1.375;margin:.75rem 0 0}',
  '.ssr .cap{font-size:.75rem;color:#595959}',
  '.ssr .byline{border-bottom:2px solid #111;padding:.75rem 0;margin:0 0 1.5rem;font-weight:700}',
  '.ssr .byline time{font-weight:400}',
  '.ssr .kf{background:#f7e14b;padding:1.25rem;max-width:42.5rem;margin:0 0 1.5rem}',
  '.ssr .kf h2{font-family:inherit;font-size:.8125rem;letter-spacing:.14em;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:.5rem;margin-bottom:.75rem}',
  '.ssr .kf ul{list-style:square;margin:0;padding-left:1.25rem;font-weight:500}',
  '.ssr .kf li{margin:.5rem 0}',
  '.ssr .body{max-width:42.5rem;font-size:1.125rem;line-height:1.65}',
  '.ssr .body p{margin:0 0 1rem}',
  '.ssr .body h2{font-size:1.5rem;margin:1.75rem 0 .5rem}',
  '.ssr .body h3{margin:1.5rem 0 .5rem}',
  '.ssr .body a{color:#004a94;text-decoration:underline}','.ssr .byline a{text-decoration:underline}',
  '.ssr .body ul{list-style:square;padding-left:1.25rem}',
  '.ssr .body ol{padding-left:1.25rem}',
  '.ssr .body blockquote{margin:1.5rem 0;padding:1rem 1.25rem;background:#111;color:#fff;font-weight:600}',
  '.ssr .body img{max-width:100%;height:auto}',
  '.ssr .ds-question{text-decoration:underline;text-decoration-color:#f7e14b;text-decoration-thickness:.42em;text-underline-offset:-.2em;text-decoration-skip-ink:none}',
  '.ssr aside.more{margin-top:2rem}',
  // Story linked to a road closure: black dates block with the times in yellow
  '.ssr .dates{background:#111;color:#fff;padding:1.25rem;max-width:42.5rem;margin:0 0 1.5rem}',
  '.ssr .dates b{color:#f7e14b;font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;font-weight:800;font-size:1.125rem}',
  '.ssr .dates a{color:#f7e14b;font-weight:800;text-decoration:underline}',
  // Homepage "Happening now" strip: black, with a yellow dot before each story
  '.ssr .now{background:#111;color:#fff;padding:1rem;margin:1rem 0}',
  '.ssr .now h2{font-size:.8125rem;letter-spacing:.14em;text-transform:uppercase;color:#f7e14b;font-family:inherit;margin-bottom:.5rem}',
  '.ssr .now ul{list-style:none;margin:0;padding:0}',
  '.ssr .now li{padding:.5rem 0 .5rem 1.25rem;position:relative}',
  '.ssr .now li::before{content:"";position:absolute;left:0;top:.95rem;width:.625rem;height:.625rem;background:#f7e14b;border-radius:50%}',
  '.ssr .now a{font-weight:800;text-decoration:none}',
  '.ssr .now time{display:block;color:#f7e14b}',
  // Dark mode (the class is on <html> before first paint): light text on the charcoal page; yellow blocks keep black text
  '.dark .ssr{color:#f4f4f1}',
  '.dark .ssr time,.dark .ssr .cap{color:#a8a8a3}',
  '.dark .ssr .hd,.dark .ssr .byline{border-color:#f4f4f1}',
  '.dark .ssr .hd span,.dark .ssr .banner,.dark .ssr .banner time,.dark .ssr .kf{color:#111}',
  '.dark .ssr .kf h2{border-color:#111}',
  '.dark .ssr .list>li{border-color:rgba(255,255,255,.2)}',
  '.dark .ssr .lab-k{background:#f4f4f1;color:#111}',
  '.dark .ssr .body a{color:#8ab8ff}',
  '.dark .ssr .now time{color:#f7e14b}',
  '.dark .ssr .ds-question{text-decoration-thickness:.16em;text-underline-offset:.14em}',
  '@media(min-width:640px){.ssr header>p{padding:.75rem 1.5rem}.ssr header img{height:2.5rem}.ssr header nav ul{padding:0 .75rem}.ssr main{padding:1rem 1.5rem}.ssr h1{font-size:2.5rem}.ssr .hero{margin:-1rem -1.5rem 0}.ssr .hero img{aspect-ratio:2/1}.ssr .panel{margin:-5rem 0 0;padding:2rem}.ssr .panel p{font-size:1.125rem}}',
].join('');

/** Wrap a page's server-rendered content in the site header (name + section links). */
export function shellHtml(sections: SectionLink[], mainHtml: string): string {
  return (
    '<div class="ssr">' +
    `<header><p><a href="/"><img src="/the-daily-scot-logo-horizontal.svg" alt="${escapeAttr(SITE_NAME)}" width="371" height="84" /></a></p>${sectionNavHtml(sections)}</header>` +
    `<main id="main-content">${mainHtml}</main>` +
    '</div>'
  );
}

export interface SeoPage {
  /** Full <title>, brand included (use withBrand()). */
  title: string;
  description: string;
  /** Absolute canonical address (left out for error pages, which have none). */
  canonical?: string;
  ogType?: 'website' | 'article' | 'profile';
  /** Absolute image address; the site's default share image when missing. */
  image?: string | null;
  imageAlt?: string;
  /** Keep this page out of Google (also sent as an X-Robots-Tag header). */
  noindex?: boolean;
  /** Structured data, serialised safely into a <script type="application/ld+json">. */
  jsonLd?: unknown;
  /** Extra raw <meta>/<link> tags (e.g. article:published_time). */
  extraHead?: string[];
  /** Real HTML for inside <div id="root">; React replaces it when the app loads. */
  rootHtml?: string;
  status?: number;
}

/**
 * Fetch the app shell (index.html) to rewrite. The shell's own ETag / Last-Modified describe the static
 * file, not the page we build from it (headlines change all day), so conditional headers are dropped:
 * otherwise a browser or crawler that revalidates gets "304 Not Modified" and keeps a stale copy of the page.
 */
export function fetchShell(context: { request: Request; next: (input?: Request | string) => Promise<Response> }): Promise<Response> {
  // Files (images, robots.txt...) keep normal caching; page addresses never contain a dot
  if ((new URL(context.request.url).pathname.split('/').pop() || '').includes('.')) return context.next();
  const request = new Request(context.request);
  request.headers.delete('If-None-Match');
  request.headers.delete('If-Modified-Since');
  return context.next(request);
}

/** Section links for the header of server-rendered pages. The header is a nicety, so a database problem just leaves it out. */
export async function loadSections(db: { prepare(q: string): { all<T>(): Promise<{ results: T[] }> } }): Promise<SectionLink[]> {
  try {
    return (await db.prepare('SELECT slug, name FROM categories ORDER BY sort_order').all<SectionLink>()).results;
  } catch (err) {
    console.warn('Could not load sections:', err);
    return [];
  }
}

const remove = { element: (el: any) => el.remove() };

/**
 * Give the app shell (index.html) this page's own head tags and, optionally, real content.
 * Everything generic in index.html is removed first so a page never ends up with two titles,
 * two descriptions or two canonical links.
 */
export function renderSeoPage(shell: Response, page: SeoPage, origin: string): Response {
  const image = page.image || `${origin}/og-default.png`;
  const defaultImage = !page.image;
  const imageAlt = page.imageAlt || (defaultImage ? "The Daily Scot – Glasgow & Scotland's Local News" : page.title);

  const tags = [
    // noindex + a canonical pointing elsewhere is a mixed signal Google advises against, so noindex pages get none
    page.canonical && !page.noindex ? `<link rel="canonical" href="${escapeAttr(page.canonical)}" />` : '',
    `<meta name="description" content="${escapeAttr(page.description)}" />`,
    page.noindex
      ? '<meta name="robots" content="noindex, follow" />'
      : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
    `<meta property="og:title" content="${escapeAttr(page.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(page.description)}" />`,
    page.canonical ? `<meta property="og:url" content="${escapeAttr(page.canonical)}" />` : '',
    `<meta property="og:type" content="${page.ogType || 'website'}" />`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    '<meta property="og:locale" content="en_GB" />',
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    defaultImage ? '<meta property="og:image:width" content="1200" />' : '',
    defaultImage ? '<meta property="og:image:height" content="630" />' : '',
    `<meta property="og:image:alt" content="${escapeAttr(imageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(page.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    ...(page.extraHead || []),
    page.rootHtml ? `<style>${SSR_CSS}</style>` : '',
    page.jsonLd ? `<script type="application/ld+json">${safeJsonForScript(page.jsonLd)}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

  const headers = new Headers(shell.headers);
  // These describe the static index.html, not the page built from it
  headers.delete('ETag');
  headers.delete('Last-Modified');
  headers.delete('Content-Length');
  if (page.noindex) headers.set('X-Robots-Tag', 'noindex');
  const status = page.status ?? shell.status;
  const page_ = new Response(shell.body, { status, statusText: shell.statusText, headers });

  // @ts-ignore - HTMLRewriter is provided by the Workers runtime
  return new HTMLRewriter()
    // Tells the app these tags are already right for this address (see src/utils/seoHead.ts)
    .on('html', {
      element(el: any) {
        el.setAttribute('data-seo', 'server');
      },
    })
    .on('title', {
      element(el: any) {
        el.setInnerContent(page.title);
      },
    })
    .on('meta[name="description"]', remove)
    .on('meta[name="robots"]', remove)
    .on('meta[property^="og:"]', remove)
    .on('meta[name^="twitter:"]', remove)
    .on('link[rel="canonical"]', remove)
    .on('head', {
      element(el: any) {
        el.append(tags, { html: true });
      },
    })
    .on('div#root', {
      element(el: any) {
        if (page.rootHtml) el.setInnerContent(page.rootHtml, { html: true });
      },
    })
    .transform(page_);
}

/**
 * A real 404 that still shows the app (which draws its own "not found" screen): noindex, cached briefly.
 * `what` names the missing thing in the heading ("Page not found", "Author not found").
 */
export function notFoundPage(shell: Response, sections: SectionLink[], origin: string, what = 'Page', message?: string): Response {
  const text = message || 'This page may have been moved, unpublished, or the link may be incorrect.';
  const headers = new Headers(shell.headers);
  headers.set('Cache-Control', 'public, max-age=60');
  return renderSeoPage(
    new Response(shell.body, { status: shell.status, headers }),
    {
      title: withBrand(`${what} not found`),
      description: text,
      noindex: true,
      status: 404,
      rootHtml: shellHtml(
        sections,
        `<h1>${escapeText(what)} not found</h1><p>${escapeText(text)}</p><p><a href="/">Go to the homepage</a></p>`,
      ),
    },
    origin,
  );
}
