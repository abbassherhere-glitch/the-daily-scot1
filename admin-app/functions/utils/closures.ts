/**
 * Road closures in the newsroom: checking what an editor typed before it is saved.
 * Labels, allowed values and the map limits are shared with the public site (src/config/closures.ts).
 */
import {
  CLOSURE_KINDS,
  CLOSURE_STATUSES,
  CLOSURES_PATH,
  inMapBounds,
  lineToGeoJson,
  parseLine,
} from '../../../src/config/closures';
import { sanitizePlainText, toSqlDateTime } from './sanitize';
import { notifySearchEnginesOfPaths } from './indexNow';

export interface ClosureInput {
  name: string;
  area: string;
  kind: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  reason: string;
  diversion: string;
  latitude: number | null;
  longitude: number | null;
  closureGeoJson: string | null;
  diversionGeoJson: string | null;
  articleId: string | null;
}

/** Cleans a create / update request. Returns the values to store, or a message to show the editor. */
export function readClosureInput(body: any): { value: ClosureInput } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Nothing was sent to save.' };

  const name = sanitizePlainText(String(body.name || ''), 160);
  if (!name) return { error: 'Give the closure a name, for example "M8 eastbound, Junction 15 to 17".' };

  const kind = String(body.kind || 'road');
  if (!(CLOSURE_KINDS as string[]).includes(kind)) return { error: 'Choose what is affected: road, motorway, bus, subway or rail.' };

  const status = String(body.status || 'planned');
  if (!(CLOSURE_STATUSES as string[]).includes(status)) return { error: 'Choose a status.' };

  const startsAt = toSqlDateTime(body.starts_at);
  const endsAt = toSqlDateTime(body.ends_at);
  if (body.starts_at && !startsAt) return { error: 'The start date and time could not be read.' };
  if (body.ends_at && !endsAt) return { error: 'The end date and time could not be read.' };
  if (startsAt && endsAt && endsAt < startsAt) return { error: 'The end date is before the start date.' };

  let latitude: number | null = null;
  let longitude: number | null = null;
  const hasLat = body.latitude !== null && body.latitude !== undefined && body.latitude !== '';
  const hasLng = body.longitude !== null && body.longitude !== undefined && body.longitude !== '';
  if (hasLat !== hasLng) return { error: 'A map position needs both a latitude and a longitude.' };
  if (hasLat && hasLng) {
    latitude = Number(body.latitude);
    longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !inMapBounds(longitude, latitude)) {
      return { error: 'The map position is outside the Glasgow area. Check the latitude (about 55.86) and longitude (about -4.25).' };
    }
  }

  const articleId = body.article_id ? sanitizePlainText(String(body.article_id), 100) : null;

  return {
    value: {
      name,
      area: sanitizePlainText(String(body.area || ''), 100),
      kind,
      status,
      startsAt,
      endsAt,
      reason: sanitizePlainText(String(body.reason || ''), 500),
      diversion: sanitizePlainText(String(body.diversion || ''), 800),
      latitude,
      longitude,
      // Lines are re-read point by point, so only clean coordinates inside the map area are ever stored
      closureGeoJson: lineToGeoJson(parseLine(body.closure_line ?? body.closure_geojson)),
      diversionGeoJson: lineToGeoJson(parseLine(body.diversion_line ?? body.diversion_geojson)),
      articleId,
    },
  };
}

export function isMissingClosuresTable(err: unknown): boolean {
  return /no such table/i.test(String((err as { message?: string })?.message || err));
}

export const MISSING_TABLE_MESSAGE =
  'Road closures are not set up in the database yet. Run migration 0005 (road_closures) in the Cloudflare D1 console, then try again.';

/** Tells search engines the closures page (and any linked story) has changed. */
export async function notifyClosuresChanged(storySlugs: (string | null | undefined)[] = []): Promise<void> {
  const stories = storySlugs.filter((s): s is string => Boolean(s)).map((slug) => `/news/${slug}`);
  await notifySearchEnginesOfPaths([CLOSURES_PATH, ...stories]);
}
