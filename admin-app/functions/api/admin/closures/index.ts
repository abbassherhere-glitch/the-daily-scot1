import { Env, EventContext, User } from '../../../types';
import { getClientIp, logAuditEvent, requireRole } from '../../../utils/auth';
import { jsonResponse } from '../../../utils/articleRules';
import {
  MISSING_TABLE_MESSAGE,
  isMissingClosuresTable,
  notifyClosuresChanged,
  readClosureInput,
} from '../../../utils/closures';

/** Same roles as stories: Owners, Editors and Journalists can add and edit closures. */
const CLOSURE_ROLES: User['role'][] = ['Owner', 'Editor', 'Journalist'];

const LIST_SQL = `
  SELECT r.*, a.slug AS story_slug, a.title AS story_title
  FROM road_closures r
  LEFT JOIN articles a ON a.id = r.article_id
  ORDER BY CASE r.status WHEN 'reopened' THEN 1 ELSE 0 END, datetime(r.starts_at) DESC, r.name
  LIMIT 300`;

/** GET /api/admin/closures: every closure, current ones first, plus recent stories to link to. */
export async function onRequestGet(context: EventContext<Env, any, { user: User }>): Promise<Response> {
  const roleErr = requireRole(context.data.user, CLOSURE_ROLES);
  if (roleErr) return roleErr;

  try {
    const { results: stories } = await context.env.DB.prepare(
      "SELECT id, title, status FROM articles WHERE status IN ('published', 'scheduled', 'approved', 'needs_review', 'draft') ORDER BY datetime(COALESCE(published_at, created_at)) DESC LIMIT 60",
    ).all();
    try {
      const { results } = await context.env.DB.prepare(LIST_SQL).all();
      return jsonResponse({ closures: results || [], stories: stories || [], ready: true });
    } catch (err) {
      if (!isMissingClosuresTable(err)) throw err;
      return jsonResponse({ closures: [], stories: stories || [], ready: false, message: MISSING_TABLE_MESSAGE });
    }
  } catch (err) {
    console.error('Failed to list closures:', err);
    return jsonResponse({ error: 'Failed to load road closures' }, 500);
  }
}

/** POST /api/admin/closures: add a closure. */
export async function onRequestPost(context: EventContext<Env, any, { user: User }>): Promise<Response> {
  const user = context.data.user;
  const roleErr = requireRole(user, CLOSURE_ROLES);
  if (roleErr) return roleErr;

  try {
    const input = readClosureInput(await context.request.json().catch(() => null));
    if ('error' in input) return jsonResponse({ error: input.error }, 400);
    const c = input.value;

    let storySlug: string | null = null;
    if (c.articleId) {
      const story = await context.env.DB.prepare('SELECT slug, status FROM articles WHERE id = ?')
        .bind(c.articleId)
        .first<{ slug: string; status: string }>();
      if (!story) return jsonResponse({ error: 'The linked story could not be found.' }, 400);
      storySlug = story.status === 'published' ? story.slug : null;
    }

    const id = `rc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await context.env.DB.prepare(
      `INSERT INTO road_closures (
         id, name, area, kind, status, starts_at, ends_at, reason, diversion,
         latitude, longitude, closure_geojson, diversion_geojson, article_id,
         created_by, last_updated_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
      .bind(
        id, c.name, c.area, c.kind, c.status, c.startsAt, c.endsAt, c.reason, c.diversion,
        c.latitude, c.longitude, c.closureGeoJson, c.diversionGeoJson, c.articleId,
        user.email, user.email,
      )
      .run();

    await logAuditEvent(context.env, user, 'CREATE_CLOSURE', {
      articleId: c.articleId,
      afterStatus: c.status,
      ip: getClientIp(context.request),
      details: `Added road closure "${c.name}" (${id}), status ${c.status}`,
    });
    await notifyClosuresChanged([storySlug]);

    return jsonResponse({ success: true, id });
  } catch (err) {
    console.error('Failed to create closure:', err);
    if (isMissingClosuresTable(err)) return jsonResponse({ error: MISSING_TABLE_MESSAGE }, 503);
    return jsonResponse({ error: 'Failed to save the closure' }, 500);
  }
}
