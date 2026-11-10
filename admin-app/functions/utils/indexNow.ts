/**
 * Tells search engines straight away that a story is new or has changed (the IndexNow protocol,
 * used by Bing and others), instead of waiting for them to re-read the sitemap.
 *
 * The key is public by design: search engines check it against the matching .txt file on the website.
 */

const SITE_HOST = 'thedailyscot.co.uk';
const INDEXNOW_KEY = 'f9719bd84df3b7f14b1560be4853e550';

/** Never throws and never holds a save up for long: a failed notification only means a slower pick-up. */
export async function notifySearchEngines(slugs: string[]): Promise<void> {
  const urlList = [...new Set(slugs.filter(Boolean))].map((slug) => `https://${SITE_HOST}/news/${slug}`);
  if (urlList.length === 0) return;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.warn('Search engine notification returned', res.status);
  } catch (err) {
    console.warn('Search engine notification failed:', err);
  }
}
