import { Env, EventContext } from '../types';
import { AUTHOR_PAGE_SIZE, getAuthorProfile, isValidAuthorSlug } from '../utils/authors';

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

/**
 * Unknown author, or an author with no published stories: serve the app shell (which shows an
 * "Author not found" page) with a real 404 status and noindex.
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
        el.setInnerContent('Author not found | The Daily Scot');
      },
    })
    .on('head', {
      element(el: any) {
        el.append('<meta name="robots" content="noindex" />', { html: true });
      },
    })
    .transform(page);
}

/**
 * /author/<slug> – author pages. The page itself is rendered by the React app; this function returns a
 * proper 404 for authors with no published stories and gives crawlers the page's own title and tags.
 */
export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const url = new URL(context.request.url);
  const segments = url.pathname.split('/').filter(Boolean); // ['author', '<slug>']
  let slug = '';
  try {
    slug = decodeURIComponent(segments[1] || '').toLowerCase();
  } catch {
    return notFound(response);
  }
  if (segments.length !== 2 || !isValidAuthorSlug(slug)) return notFound(response);

  try {
    const profile = await getAuthorProfile(context.env, slug);
    if (!profile) return notFound(response);

    const { author } = profile;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    // Past the last page (the app shows 12 stories per page)
    if (page > Math.max(1, Math.ceil(profile.total / AUTHOR_PAGE_SIZE))) return notFound(response);
    const fullTitle = `${author.name}${page > 1 ? ` – page ${page}` : ''} | The Daily Scot`;
    const description =
      author.bio || `The latest stories from ${author.name} at The Daily Scot, Glasgow and Scotland's news.`;
    const canonicalUrl = `${url.origin}/author/${encodeURIComponent(author.slug)}${page > 1 ? `?page=${page}` : ''}`;

    const tags = [
      `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
      `<meta name="description" content="${escapeAttr(description)}" />`,
      `<meta property="og:title" content="${escapeAttr(fullTitle)}" />`,
      `<meta property="og:description" content="${escapeAttr(description)}" />`,
      `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
      `<meta property="og:type" content="profile" />`,
      `<meta property="og:site_name" content="The Daily Scot" />`,
      `<meta property="og:image" content="${escapeAttr(`${url.origin}/og-default.png`)}" />`,
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:title" content="${escapeAttr(fullTitle)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    ].join('\n    ');

    // @ts-ignore - HTMLRewriter is provided by the Workers runtime
    return new HTMLRewriter()
      .on('title', {
        element(el: any) {
          el.setInnerContent(escapeText(fullTitle), { html: true });
        },
      })
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
    console.warn('Author meta injection failed:', err);
  }

  return response;
}
