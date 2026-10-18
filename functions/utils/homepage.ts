import { Env, EventContext } from '../types';
import {
  HOME_TITLE,
  HeadlineRow,
  LATEST_SQL,
  SITE_DESCRIPTION,
  SectionLink,
  escapeText,
  headlineListHtml,
  isStagingHost,
  renderSeoPage,
  shellHtml,
  siteJsonLd,
  siteOrigin,
} from './seo';

const HOME_STORIES = 30;

/**
 * The homepage (/). The page itself is drawn by the React app; this gives search engines and social
 * previews the page's own tags, structured data (who the publisher is, the site's name) and the latest
 * headlines as real links, so the front page does not depend on JavaScript to be read.
 *
 * Called from functions/[[path]].ts: Pages runs only the first matching route, and "/:path*" is ordered
 * ahead of "/", so a separate functions/index.ts would never be reached.
 */
export async function renderHomepage(context: EventContext<Env, any, any>, response: Response): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const origin = siteOrigin(context.env);

    const [sections, latest] = await Promise.all([
      context.env.DB.prepare('SELECT slug, name FROM categories ORDER BY sort_order').all<SectionLink>(),
      context.env.DB.prepare(`${LATEST_SQL} ORDER BY a.published_at DESC LIMIT ?`).bind(HOME_STORIES).all<HeadlineRow>(),
    ]);

    const main =
      '<h1>The Daily Scot – latest news from Glasgow and Scotland</h1>' +
      `<p>${escapeText(SITE_DESCRIPTION)}</p>` +
      `<ul>${headlineListHtml(latest.results)}</ul>`;

    return renderSeoPage(
      response,
      {
        title: HOME_TITLE,
        description: SITE_DESCRIPTION,
        // Always the bare address: /?utm_source=... and the like are the same page
        canonical: `${origin}/`,
        ogType: 'website',
        noindex: isStagingHost(url.hostname),
        jsonLd: siteJsonLd(origin),
        rootHtml: shellHtml(sections.results, main),
      },
      origin,
    );
  } catch (err) {
    console.warn('Homepage SEO rendering failed:', err);
    return response;
  }
}
