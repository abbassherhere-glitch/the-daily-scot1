/**
 * "Updated" times, shared by the React app (src/) and the Pages Functions (functions/).
 *
 * A story's updated time is when its headline, standfirst or body last changed (the content_updated_at
 * column), never the time of a byline change or other housekeeping save.
 */

/** A story page shows "Updated" only when the change came this long after publication */
export const SHOW_UPDATED_AFTER_MINUTES = 30;

/** Stories changed or published within this window can appear in "Happening now" on the homepage */
export const HAPPENING_NOW_MINUTES = 60;
export const HAPPENING_NOW_STORIES = 3;

/** The later of the two times: when the story was last changed, or when it was published. */
export function lastChangedIso(publishedIso?: string, contentUpdatedIso?: string): string | undefined {
  if (!contentUpdatedIso) return publishedIso;
  if (!publishedIso) return contentUpdatedIso;
  return new Date(contentUpdatedIso).getTime() > new Date(publishedIso).getTime() ? contentUpdatedIso : publishedIso;
}

/** The time to show as "Updated" on a story page, or undefined when the story has not changed enough to say so. */
export function shownUpdateIso(publishedIso?: string, contentUpdatedIso?: string): string | undefined {
  if (!publishedIso || !contentUpdatedIso) return undefined;
  const gap = new Date(contentUpdatedIso).getTime() - new Date(publishedIso).getTime();
  return gap > SHOW_UPDATED_AFTER_MINUTES * 60_000 ? contentUpdatedIso : undefined;
}

/** "14:05, 10 Nov 2026" in UK time, the same on the server and in every reader's browser. */
export function formatUkDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
  return `${time}, ${date}`;
}
