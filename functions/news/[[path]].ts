import { Env, EventContext } from '../types';

interface ArticleMetaRow {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  category: string;
  hero_image?: string;
  photo_credit?: string;
  seo_title?: string;
  meta_description?: string;
  published_at?: string;
  updated_at?: string;
  author_name?: string;
}

/** Escape a value for use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape text content (for <title>). */
function escapeText(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** JSON that is safe to embed inside a <script> element. */
function safeJsonForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Only allow absolute http(s) image URLs (or site-relative paths, made absolute). */
function safeImageUrl(value: string | undefined, origin: string): string | null {
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

/** D1 'YYYY-MM-DD HH:MM:SS' (UTC) -> ISO 8601 */
function toIso(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Unknown or unpublished story: serve the app shell (which shows a "Story not found" page)
 * with a real 404 status and noindex, so search engines don't treat it as a valid page.
 */
function notFound(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=60');
  headers.set('X-Robots-Tag', 'noindex');
  const page = new Response(response.body, { status: 404, statusText: 'Not Found', headers });
  // @ts-ignore - HTMLRewriter is provided by the Workers runtime
  return new HTMLRewriter()
    .on('title', {
      element(el: any) {
        el.setInnerContent('Story not found | The Daily Scot');
      },
    })
    .on('head', {
      element(el: any) {
        el.append('<meta name="robots" content="noindex" />', { html: true });
      },
    })
    .transform(page);
}

export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  // Only rewrite HTML responses
  if (!contentType.includes('text/html')) {
    return response;
  }

  const url = new URL(context.request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const candidateSlug = segments[segments.length - 1];

  if (!candidateSlug || candidateSlug === 'news') {
    return response;
  }

  try {
    const article = await context.env.DB.prepare(`
        SELECT
          a.id, a.slug, a.title, a.standfirst, a.category, a.hero_image, a.photo_credit,
          a.seo_title, a.meta_description, a.published_at, a.updated_at,
          u.name AS author_name
        FROM articles a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.slug = ? AND a.status = 'published' AND datetime(a.published_at) <= datetime('now')
        LIMIT 1
      `)
      .bind(decodeURIComponent(candidateSlug))
      .first<ArticleMetaRow>();

    if (!article) {
      // /news/<section> is a section page, not a story
      if (segments.length === 2) {
        const section = await context.env.DB.prepare('SELECT 1 AS ok FROM categories WHERE slug = ?')
          .bind(decodeURIComponent(candidateSlug))
          .first<{ ok: number }>();
        if (section) return response;
      }
      return notFound(response);
    }

    const title = article.seo_title || article.title;
    const description = article.meta_description || article.standfirst || '';
    const fullTitle = title.includes('The Daily Scot') ? title : `${title} | The Daily Scot`;
    const canonicalUrl = `${url.origin}/news/${encodeURIComponent(article.slug)}`;
    const heroUrl = safeImageUrl(article.hero_image, url.origin);
    // Social previews fall back to the site's default share image when a story has no photo
    const imageUrl = heroUrl || `${url.origin}/og-default.png`;
    const published = toIso(article.published_at);
    const modified = toIso(article.updated_at) || published;

    const jsonLd = safeJsonForScript({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.standfirst,
      ...(heroUrl ? { image: [heroUrl] } : {}),
      ...(published ? { datePublished: published } : {}),
      ...(modified ? { dateModified: modified } : {}),
      ...(article.author_name ? { author: [{ '@type': 'Person', name: article.author_name }] } : {}),
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
      publisher: { '@type': 'NewsMediaOrganization', name: 'The Daily Scot', url: url.origin },
    });

    const tags = [
      `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
      `<meta name="description" content="${escapeAttr(description)}" />`,
      `<meta property="og:title" content="${escapeAttr(fullTitle)}" />`,
      `<meta property="og:description" content="${escapeAttr(description)}" />`,
      `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:site_name" content="The Daily Scot" />`,
      imageUrl ? `<meta property="og:image" content="${escapeAttr(imageUrl)}" />` : '',
      published ? `<meta property="article:published_time" content="${escapeAttr(published)}" />` : '',
      `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${escapeAttr(fullTitle)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
      imageUrl ? `<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />` : '',
      `<script type="application/ld+json">${jsonLd}</script>`,
    ]
      .filter(Boolean)
      .join('\n    ');

    // @ts-ignore - HTMLRewriter is provided by the Workers runtime
    return new HTMLRewriter()
      .on('title', {
        element(el: any) {
          el.setInnerContent(escapeText(fullTitle), { html: true });
        },
      })
      // Remove the generic site-wide tags from index.html so crawlers see the article's own
      .on('meta[name="description"]', { element: (el: any) => el.remove() })
      .on('meta[property^="og:"]', { element: (el: any) => el.remove() })
      .on('meta[name^="twitter:"]', { element: (el: any) => el.remove() })
      .on('link[rel="canonical"]', { element: (el: any) => el.remove() })
      .on('head', {
        element(el: any) {
          el.append(tags, { html: true });
        },
      })
      .transform(response);
  } catch (err) {
    console.warn('Article meta injection failed:', err);
  }

  return response;
}
