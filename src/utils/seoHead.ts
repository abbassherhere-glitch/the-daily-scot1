/**
 * Keeps <head> in step with the page the reader is on after they move around inside the app.
 *
 * On the first load the server (Pages Functions) has already put the page's own title, description,
 * canonical link and structured data in <head> and marked <html data-seo="server">; the app leaves
 * those alone so what search engines read is exactly what the server sent. These helpers are only
 * used once the reader navigates, or when the server could not add its own tags.
 */

export interface HeadSeo {
  title: string;
  description: string;
  /** Absolute canonical address; omit for pages that should not have one (404, search). */
  canonical?: string;
  noindex?: boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href?: string): void {
  const existing = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const link = existing || document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  if (!existing) document.head.appendChild(link);
}

/** True when the server already wrote this page's head tags (see renderSeoPage in functions/utils/seo.ts). */
export function serverWroteHead(): boolean {
  return document.documentElement.dataset.seo === 'server';
}

export function applyHeadSeo(seo: HeadSeo): void {
  // The server's structured data describes the page that was first loaded; once the reader moves on it is stale
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
  delete document.documentElement.dataset.seo;

  document.title = seo.title;
  upsertMeta('name', 'description', seo.description);
  upsertMeta(
    'name',
    'robots',
    seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  );
  setCanonical(seo.noindex ? undefined : seo.canonical);

  upsertMeta('property', 'og:title', seo.title);
  upsertMeta('property', 'og:description', seo.description);
  if (seo.canonical) upsertMeta('property', 'og:url', seo.canonical);
  upsertMeta('name', 'twitter:title', seo.title);
  upsertMeta('name', 'twitter:description', seo.description);
}
