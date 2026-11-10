/**
 * A story's optional map pin (articles.map_latitude / map_longitude / map_label, migration 0006).
 *
 * The pin is written separately from the main story save and read with a fallback, so saving and listing
 * stories works the same whether or not the migration has been run yet.
 */
import { inScotland } from '../../../src/config/closures';
import { sanitizePlainText } from './sanitize';

interface Db {
  prepare(query: string): { bind(...values: unknown[]): { run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }> } };
}

/**
 * Saves the pin sent with a story (body.map_latitude, body.map_longitude, body.map_label). Leaving both
 * numbers empty removes the pin. Nothing happens when the request does not mention the pin at all.
 * Returns a message for the editor when the position cannot be used; never throws.
 */
export async function saveStoryPin(db: Db, articleId: string, body: any): Promise<string | null> {
  if (!body || (body.map_latitude === undefined && body.map_longitude === undefined && body.map_label === undefined)) return null;

  const empty = (v: unknown) => v === null || v === undefined || v === '';
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (!empty(body.map_latitude) || !empty(body.map_longitude)) {
    latitude = Number(body.map_latitude);
    longitude = Number(body.map_longitude);
    if (empty(body.map_latitude) || empty(body.map_longitude) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !inScotland(longitude, latitude)) {
      return 'The story was saved, but its map pin was not: the position needs a latitude and a longitude inside Scotland.';
    }
  }
  const label = latitude === null ? null : sanitizePlainText(String(body.map_label || ''), 160) || null;

  try {
    await db
      .prepare('UPDATE articles SET map_latitude = ?, map_longitude = ?, map_label = ? WHERE id = ?')
      .bind(latitude, longitude, label, articleId)
      .run();
    return null;
  } catch (err) {
    console.warn('Could not save the story map pin (has migration 0006 been run?):', err);
    return latitude === null
      ? null
      : 'The story was saved, but its map pin was not: run migration 0006 (story map pin) in the Cloudflare D1 console first.';
  }
}

/** Map pins for a set of stories, keyed by story id. Empty when the columns do not exist yet. */
export async function loadStoryPins(
  db: Db,
  ids: string[],
): Promise<Map<string, { map_latitude: number | null; map_longitude: number | null; map_label: string | null }>> {
  const out = new Map<string, { map_latitude: number | null; map_longitude: number | null; map_label: string | null }>();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    try {
      const { results } = await db
        .prepare(
          `SELECT id, map_latitude, map_longitude, map_label FROM articles
           WHERE map_latitude IS NOT NULL AND id IN (${chunk.map(() => '?').join(', ')})`,
        )
        .bind(...chunk)
        .all<{ id: string; map_latitude: number | null; map_longitude: number | null; map_label: string | null }>();
      results.forEach((r) => out.set(r.id, r));
    } catch {
      return out;
    }
  }
  return out;
}
