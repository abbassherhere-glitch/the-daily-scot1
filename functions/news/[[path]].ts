import { Env, EventContext } from '../types';
import { BYLINE_JOIN, BYLINE_SELECT, STAFF_BYLINE_SLUG } from '../utils/byline';
import { sanitizeHtml } from '../utils/sanitize';
import {
  HeadlineRow,
  LATEST_SQL,
  SITE_NAME,
  SectionLink,
  bodyToHtml,
  breadcrumbLd,
  escapeAttr,
  escapeText,
  fetchShell,
  headlineListHtml,
  humanDate,
  isStagingHost,
  notFoundPage,
  parseTags,
  plainExcerpt,
  publisherLd,
  renderSeoPage,
  safeImageUrl,
  sectionSeo,
  shellHtml,
  siteOrigin,
  toIso,
  withBrand,
  wordCount,
} from '../utils/seo';

/** Stories listed on a section page (the app shows the same number) */
const SECTION_STORIES = 50;
/** "More from <section>" links under a story */
const RELATED_STORIES = 6;

interface CategoryRow extends SectionLink {
  description: string | null;
}

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  category: string;
  category_name?: string;
  hero_image?: string;
  image_caption?: string;
  photo_credit?: string;
  tags?: string;
  seo_title?: string;
  meta_description?: string;
  published_at?: string;
  updated_at?: string;
  author_name?: string;
  author_slug?: string;
}

const PUBLISHED = "a.status = 'published' AND datetime(a.published_at) <= datetime('now')";

function redirect(location: string): Response {
  return new Response(null, { status: 301, headers: { Location: location, 'Cache-Control': 'public, max-age=3600' } });
}

/**
 * /news/*
 *   /news/<section>        section page   (glasgow, sport, ...)
 *   /news/<story-slug>     story
 *
 * The pages themselves are drawn by the React app. This function gives each address its own title,
 * description, canonical link and structured data, puts the headlines / story text into the page
 * as real HTML for crawlers that don't run JavaScript, and answers unknown addresses with a real 404.
 */
export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return context.next();

  const url = new URL(context.request.url);
  const segments = url.pathname.split('/').filter(Boolean); // ['news', ...]

  // /news on its own isn't a page of its own: the front page is the news
  if (segments.length === 1) return redirect('/');

  const response = await fetchShell(context);
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const origin = siteOrigin(context.env);
  const noindex = isStagingHost(url.hostname);
  const db = context.env.DB;

  try {
    const { results: categoryRows } = await db
      .prepare('SELECT slug, name, description FROM categories ORDER BY sort_order')
      .all<CategoryRow>();
    const sections: SectionLink[] = categoryRows;

    let slug: string;
    try {
      slug = decodeURIComponent(segments[1]);
    } catch {
      return notFoundPage(response, sections, origin);
    }

    // ---- /news/<category>/<story>: an old address shape; send people (and Google) to the real one ----
    if (segments.length === 3) {
      let storySlug = '';
      try {
        storySlug = decodeURIComponent(segments[2]);
      } catch {
        return notFoundPage(response, sections, origin);
      }
      const exists = await db
        .prepare(`SELECT a.slug FROM articles a WHERE a.slug = ? AND ${PUBLISHED} LIMIT 1`)
        .bind(storySlug)
        .first<{ slug: string }>();
      return exists ? redirect(`/news/${encodeURIComponent(exists.slug)}`) : notFoundPage(response, sections, origin);
    }
    if (segments.length > 3) return notFoundPage(response, sections, origin);

    // /news/Glasgow is the same page as /news/glasgow: one address only
    if (segments.length === 2 && slug !== slug.toLowerCase()) {
      return redirect(`/news/${encodeURIComponent(slug.toLowerCase())}`);
    }

    // ---- /news/<section> ----
    const section = categoryRows.find((c) => c.slug === slug);
    if (section) {
      const { results: stories } = await db
        .prepare(`${LATEST_SQL} AND a.category = ? ORDER BY a.published_at DESC LIMIT ?`)
        .bind(section.slug, SECTION_STORIES)
        .all<HeadlineRow>();

      const seo = sectionSeo(section.slug, section.name, section.description);
      const canonical = `${origin}/news/${encodeURIComponent(section.slug)}`;
      const main =
        `<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li>${escapeText(section.name)}</li></ol></nav>` +
        `<h1>${escapeText(section.name)}</h1>` +
        `<p>${escapeText(section.description || seo.description)}</p>` +
        (stories.length ? `<ul>${headlineListHtml(stories)}</ul>` : '<p>There are no stories in this section yet.</p>');

      return renderSeoPage(
        response,
        {
          title: seo.title,
          description: seo.description,
          canonical,
          ogType: 'website',
          noindex,
          jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
              publisherLd(origin),
              {
                '@type': 'CollectionPage',
                '@id': `${canonical}#page`,
                url: canonical,
                name: seo.title,
                description: seo.description,
                inLanguage: 'en-GB',
                isPartOf: { '@id': `${origin}/#website` },
                publisher: { '@id': `${origin}/#organization` },
                mainEntity: {
                  '@type': 'ItemList',
                  itemListElement: stories.slice(0, 20).map((s, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    url: `${origin}/news/${encodeURIComponent(s.slug)}`,
                    name: s.title,
                  })),
                },
              },
              breadcrumbLd([
                { name: 'Home', url: `${origin}/` },
                { name: section.name, url: canonical },
              ]),
            ],
          },
          rootHtml: shellHtml(sections, main),
        },
        origin,
      );
    }

    // ---- /news/<story-slug> ----
    const article = await db
      .prepare(
        `SELECT
           a.id, a.slug, a.title, a.standfirst, a.body, a.category, a.hero_image, a.image_caption, a.photo_credit,
           a.tags, a.seo_title, a.meta_description, a.published_at, a.updated_at,
           c.name AS category_name,
           ${BYLINE_SELECT}
         FROM articles a
         ${BYLINE_JOIN}
         LEFT JOIN categories c ON a.category = c.slug
         WHERE a.slug = ? AND ${PUBLISHED}
         LIMIT 1`,
      )
      .bind(slug)
      .first<ArticleRow>();

    if (!article) return notFoundPage(response, sections, origin);

    const { results: related } = await db
      .prepare(`${LATEST_SQL} AND a.category = ? AND a.slug != ? ORDER BY a.published_at DESC LIMIT ?`)
      .bind(article.category, article.slug, RELATED_STORIES)
      .all<HeadlineRow>();

    const bodyHtml = await sanitizeHtml(bodyToHtml(article.body || ''));
    const canonical = `${origin}/news/${encodeURIComponent(article.slug)}`;
    const title = withBrand(article.seo_title || article.title);
    const description = article.meta_description || article.standfirst || plainExcerpt(bodyHtml);
    const heroUrl = safeImageUrl(article.hero_image, origin);
    const published = toIso(article.published_at);
    const modified = toIso(article.updated_at) || published;
    const categoryName = article.category_name || article.category;
    const tags = parseTags(article.tags);
    const authorName = article.author_name || SITE_NAME;
    const authorUrl = article.author_slug ? `${origin}/author/${encodeURIComponent(article.author_slug)}` : undefined;
    const isStaffDesk = article.author_slug === STAFF_BYLINE_SLUG;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        publisherLd(origin),
        {
          '@type': 'NewsArticle',
          '@id': `${canonical}#article`,
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          url: canonical,
          headline: article.title,
          description,
          // Google wants a picture for news rich results; fall back to the site's share image
          image: [heroUrl || `${origin}/og-default.png`],
          ...(published ? { datePublished: published } : {}),
          ...(modified ? { dateModified: modified } : {}),
          author: [
            {
              // The staff desk is credited as the organisation, everyone else as a person
              '@type': isStaffDesk ? 'Organization' : 'Person',
              name: authorName,
              ...(authorUrl ? { url: authorUrl } : {}),
            },
          ],
          publisher: { '@id': `${origin}/#organization` },
          articleSection: categoryName,
          ...(tags.length ? { keywords: tags.join(', ') } : {}),
          inLanguage: 'en-GB',
          isAccessibleForFree: true,
          wordCount: wordCount(bodyHtml),
        },
        breadcrumbLd([
          { name: 'Home', url: `${origin}/` },
          { name: categoryName, url: `${origin}/news/${encodeURIComponent(article.category)}` },
          { name: article.title, url: canonical },
        ]),
      ],
    };

    const credit = article.photo_credit ? `Photograph: ${article.photo_credit}` : '';
    const caption = [article.image_caption, credit].filter(Boolean).join(' · ');
    const main =
      '<article>' +
      `<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li>` +
      `<li><a href="/news/${encodeURIComponent(article.category)}">${escapeText(categoryName)}</a></li></ol></nav>` +
      `<h1>${escapeText(article.title)}</h1>` +
      (article.standfirst ? `<p>${escapeText(article.standfirst)}</p>` : '') +
      `<p>By ${
        authorUrl
          ? `<a href="/author/${encodeURIComponent(article.author_slug as string)}">${escapeText(authorName)}</a>`
          : escapeText(authorName)
      }` +
      (published ? ` · <time datetime="${escapeAttr(published)}">${escapeText(humanDate(article.published_at))}</time>` : '') +
      '</p>' +
      (heroUrl
        ? `<figure><img src="${escapeAttr(heroUrl)}" alt="${escapeAttr(article.image_caption || article.title)}" />` +
          (caption ? `<figcaption>${escapeText(caption)}</figcaption>` : '') +
          '</figure>'
        : '') +
      `<div>${bodyHtml}</div>` +
      '</article>' +
      (related.length
        ? `<aside><h2>More from ${escapeText(categoryName)}</h2><ul>${headlineListHtml(related, 3)}</ul></aside>`
        : '');

    return renderSeoPage(
      response,
      {
        title,
        description,
        canonical,
        ogType: 'article',
        image: heroUrl,
        imageAlt: article.image_caption || article.title,
        noindex,
        jsonLd,
        extraHead: [
          published ? `<meta property="article:published_time" content="${escapeAttr(published)}" />` : '',
          modified ? `<meta property="article:modified_time" content="${escapeAttr(modified)}" />` : '',
          `<meta property="article:section" content="${escapeAttr(categoryName)}" />`,
          ...tags.slice(0, 6).map((t) => `<meta property="article:tag" content="${escapeAttr(t)}" />`),
        ],
        rootHtml: shellHtml(sections, main),
      },
      origin,
    );
  } catch (err) {
    console.warn('News page SEO rendering failed:', err);
    return response;
  }
}
