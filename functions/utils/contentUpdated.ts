/**
 * articles.content_updated_at arrives with migration 0004. Until that has been run on the database, any
 * query that names the column fails with "no such column". These helpers let pages ask for it and carry
 * on without it, so the site works the same before and after the migration.
 */

export const CONTENT_UPDATED_COLUMN = 'a.content_updated_at';
const WITHOUT_COLUMN = 'NULL AS content_updated_at';

function isMissingColumn(err: unknown): boolean {
  return /no such column/i.test(String((err as { message?: string })?.message || err));
}

/**
 * Runs a query that selects the column. `run` receives the text to put in the SELECT list: the real
 * column first, and a NULL stand-in if the database does not have it yet.
 */
export async function withContentUpdated<T>(run: (column: string) => Promise<T>): Promise<T> {
  try {
    return await run(CONTENT_UPDATED_COLUMN);
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    return run(WITHOUT_COLUMN);
  }
}

export interface HappeningNowRow {
  slug: string;
  title: string;
  category: string;
  category_name?: string;
  published_at: string;
  /** The later of publication and the last change to the story's words */
  changed_at: string;
}

interface Db {
  prepare(query: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
}

/**
 * Live stories published or changed in the last `minutes`, most recent first. Before migration 0004
 * only newly published stories can qualify.
 */
export async function happeningNow(db: Db, minutes: number, limit: number): Promise<HappeningNowRow[]> {
  const query = (changed: string) => `
    SELECT a.slug, a.title, a.category, c.name AS category_name, a.published_at, ${changed} AS changed_at
    FROM articles a
    LEFT JOIN categories c ON a.category = c.slug
    WHERE a.status = 'published' AND datetime(a.published_at) <= datetime('now')
      AND datetime(${changed}) >= datetime('now', ?)
    ORDER BY datetime(${changed}) DESC
    LIMIT ?`;
  const run = (changed: string) => db.prepare(query(changed)).bind(`-${minutes} minutes`, limit).all<HappeningNowRow>();
  try {
    return (await run('MAX(a.published_at, COALESCE(a.content_updated_at, a.published_at))')).results;
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    return (await run('a.published_at')).results;
  }
}
