/**
 * Road closures for the public site: reads them from the database for the API (/api/closures), the
 * server-rendered /glasgow-road-closures page, the homepage panel and the sitemap.
 *
 * The road_closures table arrives with migration 0005. Until that has been run, every read here returns an
 * empty list rather than failing, so the rest of the site is unaffected.
 */
import {
  CLOSURE_KINDS,
  CLOSURE_STATUSES,
  Closure,
  ClosureKind,
  ClosureStatus,
  TRANSPORT_STORIES,
  TRANSPORT_WORDS,
  parseLine,
  sortClosures,
} from '../../src/config/closures';
import { HeadlineRow, toIso } from './seo';

interface Db {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
    all<T>(): Promise<{ results: T[] }>;
  };
}

interface ClosureRow {
  id: string;
  name: string;
  area: string | null;
  kind: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
  diversion: string | null;
  latitude: number | null;
  longitude: number | null;
  closure_geojson: string | null;
  diversion_geojson: string | null;
  updated_at: string;
  story_slug: string | null;
  story_title: string | null;
}

function isMissingTable(err: unknown): boolean {
  return /no such table/i.test(String((err as { message?: string })?.message || err));
}

export function rowToClosure(row: ClosureRow): Closure {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const hasPin = row.latitude !== null && row.longitude !== null && Number.isFinite(lat) && Number.isFinite(lng);
  return {
    id: row.id,
    name: row.name,
    area: row.area || '',
    kind: (CLOSURE_KINDS as string[]).includes(row.kind) ? (row.kind as ClosureKind) : 'road',
    status: (CLOSURE_STATUSES as string[]).includes(row.status) ? (row.status as ClosureStatus) : 'planned',
    startsAt: toIso(row.starts_at || undefined) || null,
    endsAt: toIso(row.ends_at || undefined) || null,
    reason: row.reason || '',
    diversion: row.diversion || '',
    latitude: hasPin ? lat : null,
    longitude: hasPin ? lng : null,
    closureLine: parseLine(row.closure_geojson),
    diversionLine: parseLine(row.diversion_geojson),
    storySlug: row.story_slug || null,
    storyTitle: row.story_title || null,
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

const CLOSURE_SELECT = `
  SELECT r.id, r.name, r.area, r.kind, r.status, r.starts_at, r.ends_at, r.reason, r.diversion,
         r.latitude, r.longitude, r.closure_geojson, r.diversion_geojson, r.updated_at,
         a.slug AS story_slug, a.title AS story_title
  FROM road_closures r
  LEFT JOIN articles a
    ON a.id = r.article_id AND a.status = 'published' AND datetime(a.published_at) <= datetime('now')`;

/**
 * Everything the public should see: closures that have not ended yet, plus roads marked as reopened in the
 * last two days (so readers can see that a closure is over). Most important first.
 */
export async function loadClosures(db: Db): Promise<Closure[]> {
  try {
    const { results } = await db
      .prepare(
        `${CLOSURE_SELECT}
         WHERE (r.status != 'reopened' AND (r.ends_at IS NULL OR datetime(r.ends_at) >= datetime('now')))
            OR (r.status = 'reopened' AND datetime(r.updated_at) >= datetime('now', '-2 days'))
         LIMIT 200`,
      )
      .all<ClosureRow>();
    return sortClosures(results.map(rowToClosure));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    return [];
  }
}

/** The closure linked to a story, if any (used on story pages). */
export async function loadClosureForStory(db: Db, articleId: string): Promise<Closure | null> {
  try {
    const { results } = await db
      .prepare(`${CLOSURE_SELECT} WHERE r.article_id = ? ORDER BY datetime(r.updated_at) DESC LIMIT 1`)
      .bind(articleId)
      .all<ClosureRow>();
    return results[0] ? rowToClosure(results[0]) : null;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    return null;
  }
}

/** When the list last changed (the newest edit to any closure, shown or not). */
export async function closuresLastUpdated(db: Db): Promise<string | null> {
  try {
    const { results } = await db.prepare('SELECT MAX(updated_at) AS updated_at FROM road_closures').all<{ updated_at: string | null }>();
    return toIso(results[0]?.updated_at || undefined) || null;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    return null;
  }
}

/** The latest published stories about roads and public transport (see TRANSPORT_WORDS). */
export interface TransportStoryRow extends HeadlineRow {
  id: string;
  area?: string | null;
  hero_image?: string | null;
}

export async function transportStories(db: Db, limit = TRANSPORT_STORIES): Promise<TransportStoryRow[]> {
  // Whole words only: "bus" must not match "business"
  const patterns = TRANSPORT_WORDS.flatMap((w) => [`% ${w} %`, `%"${w}"%`, `% ${w},%`, `% ${w}s %`]);
  const haystack = "(' ' || a.title || ' ' || COALESCE(a.tags, '') || ' ')";
  const clause = patterns.map(() => `${haystack} LIKE ?`).join(' OR ');
  const { results } = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.standfirst, a.category, a.area, a.hero_image, a.published_at, c.name AS category_name
       FROM articles a
       LEFT JOIN categories c ON a.category = c.slug
       WHERE a.status = 'published' AND datetime(a.published_at) <= datetime('now') AND (${clause})
       ORDER BY a.published_at DESC
       LIMIT ?`,
    )
    .bind(...patterns, limit)
    .all<TransportStoryRow>();
  return results;
}
