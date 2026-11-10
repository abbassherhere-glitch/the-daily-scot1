import { Article, CategoryType } from '../types/news';
import { Closure } from '../config/closures';

export interface TransportStoryRow {
  id: string;
  slug: string;
  title: string;
  standfirst?: string;
  category: string;
  category_name?: string;
  area?: string | null;
  hero_image?: string | null;
  published_at?: string;
}

export interface ClosuresData {
  closures: Closure[];
  /** When the list last changed (ISO), or null when there has never been a closure */
  updatedAt: string | null;
  stories: TransportStoryRow[];
}

const EMPTY: ClosuresData = { closures: [], updatedAt: null, stories: [] };
const MAX_AGE_MS = 60_000;

let cached: { at: number; promise: Promise<ClosuresData> } | null = null;

/**
 * Closures for the page, the homepage panel and the "Live travel" line. The three share one request:
 * the answer is reused for a minute. Never throws: a problem just means nothing is shown.
 */
export function getClosures(): Promise<ClosuresData> {
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.promise;
  const promise = fetch('/api/closures')
    .then((res) => (res.ok ? (res.json() as Promise<Partial<ClosuresData>>) : EMPTY))
    .then((data) => ({ closures: data.closures || [], updatedAt: data.updatedAt || null, stories: data.stories || [] }))
    .catch(() => {
      cached = null;
      return EMPTY;
    });
  cached = { at: Date.now(), promise };
  return promise;
}

// D1 returns 'YYYY-MM-DD HH:MM:SS' in UTC
const toIso = (value?: string) =>
  value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value || new Date().toISOString();

/** A card-sized story from a transport story row; the app loads the full story when it is opened. */
export function transportStoryToArticle(row: TransportStoryRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst || '',
    category: row.category as CategoryType,
    subcategory: row.category_name || undefined,
    locationTag: row.area || undefined,
    publishedAt: toIso(row.published_at),
    content: [],
    tags: [],
    author: { name: 'The Daily Scot Staff', role: 'The Daily Scot Newsdesk', avatar: '' },
    heroImage: row.hero_image || '/placeholder-hero.svg',
    heroCaption: '',
    heroCredit: '',
    readTime: '',
    views: 0,
    comments: [],
    isPartial: true,
  };
}
