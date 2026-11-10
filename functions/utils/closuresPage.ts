import { Env, EventContext } from '../types';
import {
  CLOSURES_DESCRIPTION,
  CLOSURES_HEADING,
  CLOSURES_INTRO,
  CLOSURES_PATH,
  CLOSURES_TITLE,
  Closure,
  KIND_LABELS,
  STATUS_LABELS,
  closureDatesText,
  closureSummary,
} from '../../src/config/closures';
import { formatUkDateTime } from '../../src/config/updates';
import { closuresLastUpdated, loadClosures, transportStories } from './closures';
import {
  breadcrumbLd,
  escapeAttr,
  escapeText,
  headlineListHtml,
  isStagingHost,
  loadSections,
  publisherLd,
  renderSeoPage,
  shellHtml,
  siteOrigin,
  withBrand,
} from './seo';

/** One closure as plain HTML: the same facts, in the same order, as a list item on the app's page. */
export function closureItemHtml(c: Closure, position: number): string {
  return (
    `<li id="closure-${escapeAttr(c.id)}"><article>` +
    `<p><span class="lab ${c.status === 'reopened' ? 'lab-w' : c.status === 'planned' ? '' : 'lab-r'}">${escapeText(STATUS_LABELS[c.status])}</span> ` +
    `<span class="lab lab-k">${escapeText(KIND_LABELS[c.kind])}</span></p>` +
    `<h2>${position}. ${escapeText(c.name)}</h2>` +
    (c.area ? `<p>${escapeText(c.area)}</p>` : '') +
    `<p><strong>${escapeText(closureDatesText(c))}</strong></p>` +
    (c.reason ? `<p>${escapeText(c.reason)}</p>` : '') +
    (c.diversion ? `<p><strong>Diversion:</strong> ${escapeText(c.diversion)}</p>` : '') +
    (c.storySlug ? `<p><a href="/news/${encodeURIComponent(c.storySlug)}">Full story: ${escapeText(c.storyTitle || c.name)}</a></p>` : '') +
    '</article></li>'
  );
}

/**
 * /glasgow-road-closures. The page itself (with the map) is drawn by the React app; this gives search
 * engines the page's own title, description, canonical link and structured data, and lists every closure
 * as text so nothing depends on JavaScript or the map to be read.
 */
export async function renderClosuresPage(context: EventContext<Env, any, any>, response: Response): Promise<Response> {
  const url = new URL(context.request.url);
  const origin = siteOrigin(context.env);
  const db = context.env.DB;
  const canonical = `${origin}${CLOSURES_PATH}`;

  const [sections, closures, updatedAt, stories] = await Promise.all([
    loadSections(db),
    loadClosures(db),
    closuresLastUpdated(db),
    transportStories(db).catch(() => []),
  ]);

  const main =
    '<nav aria-label="Breadcrumb"><ol><li><a class="lab lab-k" href="/">Home</a></li><li><span class="lab">Road closures</span></li></ol></nav>' +
    `<div class="banner"><h1>${escapeText(CLOSURES_HEADING)}</h1>` +
    (updatedAt ? `<p>Last updated: <time datetime="${escapeAttr(updatedAt)}">${escapeText(formatUkDateTime(updatedAt))}</time></p>` : '') +
    '</div>' +
    `<p>${escapeText(CLOSURES_INTRO)}</p>` +
    (closures.length
      ? `<ol class="list">${closures.map((c, i) => closureItemHtml(c, i + 1)).join('')}</ol>`
      : '<p>There are no road closures listed at the moment.</p>') +
    (stories.length
      ? `<aside class="more"><h2 class="hd"><span>Latest transport stories</span></h2><ul class="list">${headlineListHtml(stories, 3)}</ul></aside>`
      : '');

  return renderSeoPage(
    response,
    {
      title: withBrand(CLOSURES_TITLE),
      description: CLOSURES_DESCRIPTION,
      canonical,
      ogType: 'website',
      noindex: isStagingHost(url.hostname),
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          publisherLd(origin),
          {
            '@type': 'CollectionPage',
            '@id': `${canonical}#page`,
            url: canonical,
            name: CLOSURES_HEADING,
            headline: CLOSURES_TITLE,
            description: CLOSURES_DESCRIPTION,
            inLanguage: 'en-GB',
            ...(updatedAt ? { dateModified: updatedAt } : {}),
            isPartOf: { '@id': `${origin}/#website` },
            publisher: { '@id': `${origin}/#organization` },
            about: { '@type': 'City', name: 'Glasgow' },
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: closures.length,
              itemListElement: closures.map((c, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: c.name,
                description: closureSummary(c),
                url: c.storySlug ? `${origin}/news/${encodeURIComponent(c.storySlug)}` : `${canonical}#closure-${encodeURIComponent(c.id)}`,
              })),
            },
          },
          breadcrumbLd([
            { name: 'Home', url: `${origin}/` },
            { name: 'Glasgow road closures', url: canonical },
          ]),
        ],
      },
      rootHtml: shellHtml(sections, main),
    },
    origin,
  );
}
