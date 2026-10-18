import { Env, EventContext } from './types';
import { companyDetailsIncomplete, infoPageByPath } from '../src/config/infoPages';
import { renderHomepage } from './utils/homepage';
import {
  escapeText,
  fetchShell,
  isStagingHost,
  loadSections,
  notFoundPage,
  renderSeoPage,
  shellHtml,
  siteOrigin,
  withBrand,
} from './utils/seo';

/**
 * The homepage, plus everything not handled by a more specific function (/news/*, /author/*, /api/*, the feeds).
 *
 * Pages Functions answer any address that isn't a file with the app shell (index.html) and a 200,
 * so /made-up-address would look like a real page to Google. Here:
 *   - the homepage gets its own tags, structured data and headlines (see utils/homepage.ts);
 *   - the company / legal pages (/about, /privacy...) get their own title, description and canonical link;
 *   - /search is the one other page the app draws, and is kept out of Google;
 *   - anything else that comes back as the app shell is answered with a real 404.
 * Files (images, scripts, robots.txt...) are returned untouched.
 */
export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return context.next();

  const response = await fetchShell(context);
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const origin = siteOrigin(context.env);

  if (path === '/') return renderHomepage(context, response);

  try {
    const sections = await loadSections(context.env.DB);

    const info = infoPageByPath(path);
    if (info) {
      return renderSeoPage(
        response,
        {
          title: withBrand(info.title),
          description: info.description,
          canonical: `${origin}${info.path}`,
          // Not for Google until the company details in src/config/site.ts are real (they are placeholders today)
          noindex: companyDetailsIncomplete() || isStagingHost(url.hostname),
          rootHtml: shellHtml(sections, `<h1>${escapeText(info.title)}</h1><p>${escapeText(info.description)}</p>`),
        },
        origin,
      );
    }

    if (path === '/search') {
      return renderSeoPage(
        response,
        {
          title: withBrand('Search stories'),
          description: 'Search stories from The Daily Scot.',
          noindex: true,
          rootHtml: shellHtml(sections, '<h1>Search stories</h1>'),
        },
        origin,
      );
    }

    return notFoundPage(response, sections, origin);
  } catch (err) {
    console.warn('Catch-all SEO rendering failed:', err);
    return response;
  }
}
