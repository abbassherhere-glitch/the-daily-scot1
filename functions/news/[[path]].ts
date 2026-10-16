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
}

export async function onRequest(
  context: EventContext<Env, any, any>
): Promise<Response> {
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
    const article = await context.env.DB
      .prepare(`
        SELECT 
          id, slug, title, standfirst, category, hero_image, photo_credit,
          seo_title, meta_description, published_at, updated_at
        FROM articles
        WHERE slug = ? AND status = 'published' AND published_at <= datetime('now')
        LIMIT 1
      `)
      .bind(candidateSlug)
      .first<ArticleMetaRow>();

    if (!article) {
      return response;
    }

    const title = article.seo_title || article.title;
    const description = article.meta_description || article.standfirst;
    const fullTitle = `${title} | The Daily Scot`;
    const canonicalUrl = `${url.origin}/news/${article.slug}`;
    const imageUrl = article.hero_image || `${url.origin}/og-default.jpg`;

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.standfirst,
      image: [imageUrl],
      datePublished: article.published_at || new Date().toISOString(),
      dateModified: article.updated_at || article.published_at || new Date().toISOString(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      publisher: {
        '@type': 'NewsMediaOrganization',
        name: 'The Daily Scot',
        url: url.origin,
      },
    });

    // @ts-ignore
    if (typeof HTMLRewriter !== 'undefined') {
      // @ts-ignore
      return new HTMLRewriter()
        .on('title', {
          element(el: any) {
            el.setInnerContent(fullTitle);
          },
        })
        .on('head', {
          element(el: any) {
            // Append social meta tags and structured data
            el.append(`<link rel="canonical" href="${canonicalUrl}" />`, { html: true });
            el.append(`<meta name="description" content="${description.replace(/"/g, '&quot;')}" />`, { html: true });
            el.append(`<meta property="og:title" content="${fullTitle.replace(/"/g, '&quot;')}" />`, { html: true });
            el.append(`<meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />`, { html: true });
            el.append(`<meta property="og:url" content="${canonicalUrl}" />`, { html: true });
            el.append(`<meta property="og:type" content="article" />`, { html: true });
            el.append(`<meta property="og:image" content="${imageUrl}" />`, { html: true });
            el.append(`<meta property="og:site_name" content="The Daily Scot" />`, { html: true });
            el.append(`<meta name="twitter:card" content="summary_large_image" />`, { html: true });
            el.append(`<meta name="twitter:title" content="${fullTitle.replace(/"/g, '&quot;')}" />`, { html: true });
            el.append(`<meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />`, { html: true });
            el.append(`<meta name="twitter:image" content="${imageUrl}" />`, { html: true });
            el.append(`<script type="application/ld+json">${jsonLd}</script>`, { html: true });
          },
        })
        .transform(response);
    }
  } catch (err) {
    console.warn('HTMLRewriter injection exception:', err);
  }

  return response;
}
