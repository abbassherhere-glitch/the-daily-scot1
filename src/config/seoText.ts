/**
 * Page titles and descriptions shared by the React app (src/) and the Pages Functions (functions/),
 * so the text search engines read from the server is exactly the text the app shows after it loads.
 */

export const SITE_NAME = 'The Daily Scot';

export const SITE_DESCRIPTION =
  "The Daily Scot is an independent Glasgow and Scotland news website: breaking news, council, courts, transport, property, Celtic and Rangers, and what's on.";

export const HOME_TITLE = "The Daily Scot | Glasgow & Scotland's News";

/** "Headline" -> "Headline | The Daily Scot" (unless the editor already put the name in). */
export function withBrand(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

/** Titles and descriptions written for search results. Anything not listed falls back to the database name/description. */
const SECTION_SEO: Record<string, { title: string; description: string }> = {
  news: {
    title: 'Latest Glasgow & Scotland News',
    description: 'Breaking news, crime, courts and council reports from Glasgow and across Scotland, reported by The Daily Scot.',
  },
  glasgow: {
    title: 'Glasgow News & Local Stories',
    description: "Local news from across Glasgow: community stories, neighbourhood issues, council decisions and what's happening in the city.",
  },
  scotland: {
    title: 'Scotland News & Current Affairs',
    description: 'Scottish national news, transport and politics: the latest stories from across Scotland.',
  },
  politics: {
    title: 'Scottish & Glasgow Politics News',
    description: 'Politics from Glasgow City Chambers, Holyrood and Scottish councils: decisions, debates and analysis.',
  },
  business: {
    title: 'Glasgow & Scottish Business News',
    description: 'Business news from Glasgow and Scotland: local high streets, commercial property, jobs and retail.',
  },
  property: {
    title: 'Glasgow Property News & House Prices',
    description: 'Glasgow property news: house prices, tenement sales, new developments and the local housing market.',
  },
  sport: {
    title: 'Scottish Sport: Celtic, Rangers & More',
    description: "Scottish sport news and reports: Celtic, Rangers, Partick Thistle, Queen's Park and more from Glasgow and Scotland.",
  },
  'whats-on': {
    title: "What's On in Glasgow: Events & Food",
    description: "What's on in Glasgow: restaurants, food and drink, gigs, events and things to do in the city.",
  },
  opinion: {
    title: 'Opinion, Comment & Analysis',
    description: 'Opinion, letters and analysis from The Daily Scot columnists on Glasgow and Scottish life.',
  },
};

export function sectionSeo(slug: string, name: string, dbDescription?: string | null) {
  const known = SECTION_SEO[slug];
  return {
    title: withBrand(known?.title || `${name} News`),
    description: known?.description || dbDescription || `The latest ${name} stories from Glasgow and Scotland.`,
  };
}
