/**
 * Road closures: text, labels and rules shared by the React app (src/), the Pages Functions (functions/)
 * and the newsroom (admin-app/), so every version of the page says the same thing.
 */

export const CLOSURES_PATH = '/glasgow-road-closures';
export const CLOSURES_HEADING = 'Glasgow road closures and roadworks';
export const CLOSURES_TITLE = 'Glasgow Road Closures Today: Roadworks, Map & Diversions';
export const CLOSURES_DESCRIPTION =
  'Glasgow road closures and roadworks today: a live map and list of closed roads, motorway works on the M8, M74 and M77, bus, Subway and rail disruption, dates and diversion routes.';
export const CLOSURES_INTRO =
  'Every current and planned road closure in Glasgow that we know about, with dates and diversion routes. Motorway, bus, Subway and rail disruption is included.';

export type ClosureStatus = 'closed' | 'overnight' | 'extended' | 'planned' | 'reopened';
export type ClosureKind = 'road' | 'motorway' | 'bus' | 'subway' | 'rail';

export const CLOSURE_STATUSES: ClosureStatus[] = ['closed', 'overnight', 'extended', 'planned', 'reopened'];
export const CLOSURE_KINDS: ClosureKind[] = ['road', 'motorway', 'bus', 'subway', 'rail'];

export const STATUS_LABELS: Record<ClosureStatus, string> = {
  closed: 'Closed',
  overnight: 'Overnight closure',
  extended: 'Extended',
  planned: 'Planned',
  reopened: 'Reopened',
};

export const KIND_LABELS: Record<ClosureKind, string> = {
  road: 'Road',
  motorway: 'Motorway',
  bus: 'Bus',
  subway: 'Subway',
  rail: 'Rail',
};

/** A [longitude, latitude] pair, as GeoJSON orders them */
export type LngLat = [number, number];

/** A closure as the public site receives it (dates are ISO 8601, UTC) */
export interface Closure {
  id: string;
  name: string;
  area: string;
  kind: ClosureKind;
  status: ClosureStatus;
  startsAt: string | null;
  endsAt: string | null;
  reason: string;
  diversion: string;
  latitude: number | null;
  longitude: number | null;
  /** The closed stretch, as a line of points */
  closureLine: LngLat[] | null;
  /** The diversion route, as a line of points */
  diversionLine: LngLat[] | null;
  /** Linked story, when there is one */
  storySlug: string | null;
  storyTitle: string | null;
  updatedAt: string;
}

/** Glasgow city centre: where the map opens when there is nothing to show */
export const GLASGOW_CENTRE: LngLat = [-4.2518, 55.8642];

/** Rough box around Greater Glasgow and its motorways; map positions outside it are rejected as typing mistakes */
export const MAP_BOUNDS = { west: -5.2, east: -3.3, south: 55.4, north: 56.3 };

export function inMapBounds(lng: number, lat: number): boolean {
  return lng >= MAP_BOUNDS.west && lng <= MAP_BOUNDS.east && lat >= MAP_BOUNDS.south && lat <= MAP_BOUNDS.north;
}

/** Reads a stored GeoJSON LineString (or a bare array of [lng, lat] pairs) into a clean list of points. */
export function parseLine(raw: unknown): LngLat[] | null {
  if (!raw) return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const coords = Array.isArray(value) ? value : value?.type === 'Feature' ? value.geometry?.coordinates : value?.coordinates;
    if (!Array.isArray(coords)) return null;
    const points = coords
      .filter((p: unknown) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
      .map((p: number[]) => [Math.round(Number(p[0]) * 1e6) / 1e6, Math.round(Number(p[1]) * 1e6) / 1e6] as LngLat)
      .filter(([lng, lat]: LngLat) => inMapBounds(lng, lat))
      .slice(0, 200);
    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}

export function lineToGeoJson(points: LngLat[] | null): string | null {
  return points && points.length >= 2 ? JSON.stringify({ type: 'LineString', coordinates: points }) : null;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

/** Has it started (or has no start date) and not yet ended? */
function inDateRange(c: Closure, now: number): boolean {
  const start = time(c.startsAt);
  const end = time(c.endsAt);
  return (Number.isNaN(start) || start <= now) && (Number.isNaN(end) || end >= now);
}

/** In force right now: marked closed, overnight or extended, and inside its dates. */
export function isClosedNow(c: Closure, now = Date.now()): boolean {
  return (c.status === 'closed' || c.status === 'overnight' || c.status === 'extended') && inDateRange(c, now);
}

/** Starts within the next seven days. */
export function startsThisWeek(c: Closure, now = Date.now()): boolean {
  if (c.status === 'reopened') return false;
  const start = time(c.startsAt);
  return !Number.isNaN(start) && start > now && start <= now + 7 * 86_400_000;
}

export type ClosureFilter = 'all' | 'closed-now' | 'this-week' | 'motorways' | 'public-transport';

export const CLOSURE_FILTERS: { id: ClosureFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'closed-now', label: 'Closed now' },
  { id: 'this-week', label: 'Starting this week' },
  { id: 'motorways', label: 'Motorways' },
  { id: 'public-transport', label: 'Bus, subway and rail' },
];

export function matchesFilter(c: Closure, filter: ClosureFilter, now = Date.now()): boolean {
  switch (filter) {
    case 'closed-now':
      return isClosedNow(c, now);
    case 'this-week':
      return startsThisWeek(c, now);
    case 'motorways':
      return c.kind === 'motorway';
    case 'public-transport':
      return c.kind === 'bus' || c.kind === 'subway' || c.kind === 'rail';
    default:
      return true;
  }
}

/**
 * Most important first: closures in force now (motorways ahead of other roads), then upcoming ones by start
 * date, then roads that have reopened. This is the order of the list, the pin numbers and the homepage panel.
 */
export function sortClosures(list: Closure[], now = Date.now()): Closure[] {
  const group = (c: Closure) => (c.status === 'reopened' ? 3 : isClosedNow(c, now) ? (c.kind === 'motorway' ? 0 : 1) : 2);
  const startOf = (c: Closure) => (Number.isNaN(time(c.startsAt)) ? Number.MAX_SAFE_INTEGER : time(c.startsAt));
  return [...list].sort((a, b) => group(a) - group(b) || startOf(a) - startOf(b) || a.name.localeCompare(b.name));
}

/** Closures in force now, most important first (homepage panel and the "Live travel" line). */
export function currentClosures(list: Closure[], now = Date.now()): Closure[] {
  return sortClosures(list, now).filter((c) => isClosedNow(c, now));
}

const UK_DATE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' };
const UK_TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' };

/** "Mon 16 Nov, 8:00 pm" in UK time */
export function formatClosureDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-GB', UK_DATE)}, ${d.toLocaleTimeString('en-GB', UK_TIME)}`;
}

/** "From Mon 16 Nov, 8:00 pm until Fri 4 Dec, 6:00 am", coping with either date being unknown. */
export function closureDatesText(c: Pick<Closure, 'startsAt' | 'endsAt' | 'status'>): string {
  const start = formatClosureDateTime(c.startsAt);
  const end = formatClosureDateTime(c.endsAt);
  if (c.status === 'reopened') return end ? `Reopened ${end}` : 'Now reopened';
  if (start && end) return `From ${start} until ${end}`;
  if (start) return `From ${start}, until further notice`;
  if (end) return `Until ${end}`;
  return 'Dates to be confirmed';
}

/** One plain sentence about a closure, for search-engine descriptions and structured data. */
export function closureSummary(c: Closure): string {
  return [
    `${STATUS_LABELS[c.status]}: ${c.name}${c.area ? ` (${c.area})` : ''}.`,
    `${closureDatesText(c)}.`,
    c.reason ? `${c.reason.replace(/\.+$/, '')}.` : '',
    c.diversion ? `Diversion: ${c.diversion.replace(/\.+$/, '')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Stories that count as transport news for the "Latest transport stories" list. The server builds the list
 * with these words (in the headline or tags), so the app and the server-rendered page always agree.
 */
export const TRANSPORT_WORDS = [
  'road', 'roadworks', 'closure', 'closed', 'traffic', 'motorway', 'M8', 'M74', 'M77', 'M80', 'bridge',
  'bus', 'subway', 'rail', 'train', 'ScotRail', 'transport', 'travel', 'diversion', 'tunnel',
];
export const TRANSPORT_STORIES = 6;
