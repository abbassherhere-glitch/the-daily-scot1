import { Env, EventContext } from '../types';
import { BYLINE_SLUG_MATCH, STAFF_BYLINE_SLUG } from '../utils/byline';
import { AUTHOR_PAGE_SIZE, PUBLISHED_SQL, getAuthorProfile, isValidAuthorSlug } from '../utils/authors';
import {
  HeadlineRow,
  SITE_NAME,
  breadcrumbLd,
  escapeAttr,
  escapeText,
  fetchShell,
  headlineListHtml,
  isStagingHost,
  loadSections,
  notFoundPage,
  publisherLd,
  renderSeoPage,
  safeImageUrl,
  shellHtml,
  siteOrigin,
  withBrand,
} from '../utils/seo';

/**
 * /author/<slug> – author pages. The page itself is drawn by the React app; this function returns a
 * proper 404 for authors with no published stories, and gives crawlers the page's own title, tags,
 * structured data and list of stories.
 */
export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return context.next();

  const response = await fetchShell(context);
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const url = new URL(context.request.url);
  const origin = siteOrigin(context.env);
  const db = context.env.DB;
  const segments = url.pathname.split('/').filter(Boolean); // ['author', '<slug>']

  const sections = await loadSections(db);

  let decoded = '';
  try {
    decoded = decodeURIComponent(segments[1] || '');
  } catch {
    return notFoundPage(response, sections, origin, 'Author', 'There are no published stories with this byline.');
  }
  const slug = decoded.toLowerCase();
  if (segments.length !== 2 || !isValidAuthorSlug(slug)) return notFoundPage(response, sections, origin, 'Author', 'There are no published stories with this byline.');

  // /author/Syed-Hassan is the same page as /author/syed-hassan: one address only
  if (decoded !== slug) {
    return new Response(null, {
      status: 301,
      headers: { Location: `/author/${encodeURIComponent(slug)}${url.search}`, 'Cache-Control': 'public, max-age=3600' },
    });
  }

  try {
    const profile = await getAuthorProfile(context.env, slug);
    if (!profile) return notFoundPage(response, sections, origin, 'Author', 'There are no published stories with this byline.');

    const { author, total } = profile;
    const totalPages = Math.max(1, Math.ceil(total / AUTHOR_PAGE_SIZE));
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    // Past the last page (the app shows 12 stories per page)
    if (page > totalPages) return notFoundPage(response, sections, origin, 'Author', 'There are no published stories with this byline.');

    const { results: stories } = await db
      .prepare(
        `SELECT a.slug, a.title, a.standfirst, a.category, a.published_at, c.name AS category_name
         FROM articles a
         LEFT JOIN categories c ON a.category = c.slug
         WHERE ${PUBLISHED_SQL} AND ${BYLINE_SLUG_MATCH}
         ORDER BY a.published_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(slug, slug, AUTHOR_PAGE_SIZE, (page - 1) * AUTHOR_PAGE_SIZE)
      .all<HeadlineRow>();

    const fullTitle = withBrand(`${author.name}${page > 1 ? ` – page ${page}` : ''}`);
    const description =
      author.bio || `The latest stories from ${author.name} at ${SITE_NAME}, Glasgow and Scotland's news.`;
    const base = `${origin}/author/${encodeURIComponent(author.slug)}`;
    const canonical = `${base}${page > 1 ? `?page=${page}` : ''}`;
    const photo = safeImageUrl(author.photo, origin);

    const pageLink = (n: number, label: string) =>
      `<a href="/author/${encodeURIComponent(author.slug)}${n > 1 ? `?page=${n}` : ''}">${escapeText(label)}</a>`;
    const pagination =
      totalPages > 1
        ? `<nav aria-label="Pages"><p>Page ${page} of ${totalPages}</p>` +
          (page > 1 ? pageLink(page - 1, 'Newer stories') : '') +
          (page < totalPages ? pageLink(page + 1, 'Older stories') : '') +
          '</nav>'
        : '';

    const main =
      `<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li>${escapeText(author.name)}</li></ol></nav>` +
      (photo ? `<img src="${escapeAttr(photo)}" alt="" />` : '') +
      `<h1>${escapeText(author.name)}</h1>` +
      `<p>${escapeText(author.role)}</p>` +
      (author.bio ? `<p>${escapeText(author.bio)}</p>` : '') +
      `<p>${total} ${total === 1 ? 'story' : 'stories'}</p>` +
      `<ul>${headlineListHtml(stories)}</ul>` +
      pagination;

    const isDesk = author.slug === STAFF_BYLINE_SLUG;
    const profileEntity = isDesk
      ? { '@id': `${origin}/#organization` }
      : {
          '@type': 'Person',
          '@id': `${base}#person`,
          name: author.name,
          url: base,
          ...(author.type === 'staff' ? { jobTitle: author.role } : {}),
          ...(author.bio ? { description: author.bio } : {}),
          ...(photo ? { image: photo } : {}),
          worksFor: { '@id': `${origin}/#organization` },
        };

    return renderSeoPage(
      response,
      {
        title: fullTitle,
        description,
        canonical,
        ogType: 'profile',
        image: photo,
        imageAlt: author.name,
        noindex: isStagingHost(url.hostname),
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            publisherLd(origin),
            ...(isDesk ? [] : [profileEntity]),
            {
              '@type': 'ProfilePage',
              '@id': `${canonical}#page`,
              url: canonical,
              name: fullTitle,
              inLanguage: 'en-GB',
              isPartOf: { '@id': `${origin}/#website` },
              mainEntity: isDesk ? profileEntity : { '@id': `${base}#person` },
            },
            breadcrumbLd([
              { name: 'Home', url: `${origin}/` },
              { name: author.name, url: base },
            ]),
          ],
        },
        rootHtml: shellHtml(sections, main),
      },
      origin,
    );
  } catch (err) {
    console.warn('Author page SEO rendering failed:', err);
    return response;
  }
}
