/**
 * Public-site byline helpers (migration 0003).
 *
 * Stories are credited by articles.byline / byline_slug / byline_user_id. Stories saved before bylines
 * existed have NULL there and are shown as The Daily Scot Staff. articles.author_id (the staff account that
 * really posted the story) is internal and is never exposed by the public API.
 *
 * Use BYLINE_SELECT in any public query that also does `LEFT JOIN users bu ON a.byline_user_id = bu.id`.
 */

export const STAFF_BYLINE = 'The Daily Scot Staff';
export const STAFF_BYLINE_SLUG = 'the-daily-scot-staff';
export const STAFF_BYLINE_ROLE = 'The Daily Scot Newsdesk';
export const STAFF_BYLINE_BIO =
  'Reporting from The Daily Scot newsdesk in Glasgow, covering the city and Scotland.';

export const BYLINE_JOIN = 'LEFT JOIN users bu ON a.byline_user_id = bu.id';

export const BYLINE_SELECT = `
  COALESCE(NULLIF(TRIM(a.byline), ''), '${STAFF_BYLINE}') AS author_name,
  COALESCE(NULLIF(a.byline_slug, ''), '${STAFF_BYLINE_SLUG}') AS author_slug,
  CASE
    WHEN a.byline_user_id IS NOT NULL THEN bu.role
    WHEN NULLIF(a.byline_slug, '') IS NOT NULL AND a.byline_slug != '${STAFF_BYLINE_SLUG}' THEN 'Guest contributor'
    ELSE '${STAFF_BYLINE_ROLE}'
  END AS author_role,
  CASE WHEN a.byline_user_id IS NOT NULL THEN bu.photo ELSE NULL END AS author_photo`;

/** SQL condition matching every story credited to `slug` (binds the slug twice). */
export const BYLINE_SLUG_MATCH = `(a.byline_slug = ? OR (? = '${STAFF_BYLINE_SLUG}' AND NULLIF(a.byline_slug, '') IS NULL))`;
