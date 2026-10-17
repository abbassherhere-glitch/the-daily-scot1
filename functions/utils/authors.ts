import { Env } from '../types';
import {
  BYLINE_SLUG_MATCH,
  STAFF_BYLINE,
  STAFF_BYLINE_BIO,
  STAFF_BYLINE_ROLE,
  STAFF_BYLINE_SLUG,
} from './byline';

/** Stories per author page (must match AUTHOR_PAGE_SIZE in src/services/api.ts) */
export const AUTHOR_PAGE_SIZE = 12;

/** Author page slugs look like 'syed-hassan' (same rules as generateSlug in the newsroom). */
export function isValidAuthorSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 90;
}

export const PUBLISHED_SQL = "a.status = 'published' AND datetime(a.published_at) <= datetime('now')";

export interface AuthorProfile {
  slug: string;
  name: string;
  role: string;
  bio: string | null;
  photo: string | null;
  type: 'staff_desk' | 'staff' | 'guest';
}

/**
 * Looks up an author page by byline slug. Returns null when nobody with that byline has a
 * published story (drafts, scheduled, unpublished and archived stories never count).
 */
export async function getAuthorProfile(env: Env, slug: string): Promise<{ author: AuthorProfile; total: number } | null> {
  const row = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        (SELECT a2.byline FROM articles a2
           WHERE a2.byline_slug = ? AND a2.status = 'published' AND datetime(a2.published_at) <= datetime('now')
           ORDER BY a2.published_at DESC LIMIT 1) AS latest_byline,
        (SELECT a3.byline_user_id FROM articles a3
           WHERE a3.byline_slug = ? AND a3.byline_user_id IS NOT NULL
             AND a3.status = 'published' AND datetime(a3.published_at) <= datetime('now')
           ORDER BY a3.published_at DESC LIMIT 1) AS user_id
      FROM articles a
      WHERE ${PUBLISHED_SQL} AND ${BYLINE_SLUG_MATCH}
    `)
    .bind(slug, slug, slug, slug)
    .first<{ total: number; latest_byline: string | null; user_id: string | null }>();

  if (!row || !row.total) return null;

  if (slug === STAFF_BYLINE_SLUG) {
    return {
      total: row.total,
      author: { slug, name: STAFF_BYLINE, role: STAFF_BYLINE_ROLE, bio: STAFF_BYLINE_BIO, photo: null, type: 'staff_desk' },
    };
  }

  if (row.user_id) {
    // Name and bio come from Staff Users (bots are never shown)
    const staff = await env.DB.prepare("SELECT name, role, bio, photo FROM users WHERE id = ? AND role != 'Bot'")
      .bind(row.user_id)
      .first<{ name: string; role: string; bio: string | null; photo: string | null }>();
    if (staff) {
      return {
        total: row.total,
        author: { slug, name: staff.name, role: staff.role, bio: staff.bio || null, photo: staff.photo || null, type: 'staff' },
      };
    }
  }

  return {
    total: row.total,
    author: { slug, name: row.latest_byline || slug, role: 'Guest contributor', bio: null, photo: null, type: 'guest' },
  };
}

