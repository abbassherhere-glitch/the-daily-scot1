import { Env, EventContext, User } from '../../../types';
import { getClientIp, logAuditEvent, requireRole } from '../../../utils/auth';
import { jsonResponse } from '../../../utils/articleRules';
import {
  MISSING_TABLE_MESSAGE,
  isMissingClosuresTable,
  notifyClosuresChanged,
  readClosureInput,
} from '../../../utils/closures';

interface StoredClosure {
  id: string;
  name: string;
  status: string;
  article_id: string | null;
}

async function storySlug(env: Env, articleId: string | null): Promise<string | null> {
  if (!articleId) return null;
  const story = await env.DB.prepare("SELECT slug FROM articles WHERE id = ? AND status = 'published'")
    .bind(articleId)
    .first<{ slug: string }>();
  return story?.slug || null;
}

/**
 * PUT /api/admin/closures/<id>: change a closure (Owner / Editor / Journalist, as for stories).
 * Send { "end": true } on its own to end it: the status becomes "reopened" and the end time becomes now.
 */
export async function onRequestPut(context: EventContext<Env, 'id', { user: User }>): Promise<Response> {
  const user = context.data.user;
  const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
  if (roleErr) return roleErr;

  try {
    const id = context.params.id as string;
    const existing = await context.env.DB.prepare('SELECT id, name, status, article_id FROM road_closures WHERE id = ?')
      .bind(id)
      .first<StoredClosure>();
    if (!existing) return jsonResponse({ error: 'Closure not found' }, 404);

    const body = (await context.request.json().catch(() => null)) as any;

    if (body?.end === true) {
      await context.env.DB.prepare(
        "UPDATE road_closures SET status = 'reopened', ends_at = datetime('now'), last_updated_by = ?, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(user.email, id)
        .run();
      await logAuditEvent(context.env, user, 'END_CLOSURE', {
        articleId: existing.article_id,
        beforeStatus: existing.status,
        afterStatus: 'reopened',
        ip: getClientIp(context.request),
        details: `Ended road closure "${existing.name}" (${id})`,
      });
      await notifyClosuresChanged([await storySlug(context.env, existing.article_id)]);
      return jsonResponse({ success: true, id, status: 'reopened' });
    }

    const input = readClosureInput(body);
    if ('error' in input) return jsonResponse({ error: input.error }, 400);
    const c = input.value;

    if (c.articleId) {
      const story = await context.env.DB.prepare('SELECT id FROM articles WHERE id = ?').bind(c.articleId).first();
      if (!story) return jsonResponse({ error: 'The linked story could not be found.' }, 400);
    }

    await context.env.DB.prepare(
      `UPDATE road_closures SET
         name = ?, area = ?, kind = ?, status = ?, starts_at = ?, ends_at = ?, reason = ?, diversion = ?,
         latitude = ?, longitude = ?, closure_geojson = ?, diversion_geojson = ?, article_id = ?,
         last_updated_by = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(
        c.name, c.area, c.kind, c.status, c.startsAt, c.endsAt, c.reason, c.diversion,
        c.latitude, c.longitude, c.closureGeoJson, c.diversionGeoJson, c.articleId,
        user.email, id,
      )
      .run();

    await logAuditEvent(context.env, user, 'UPDATE_CLOSURE', {
      articleId: c.articleId,
      beforeStatus: existing.status,
      afterStatus: c.status,
      ip: getClientIp(context.request),
      details: `Updated road closure "${c.name}" (${id}), status ${existing.status} to ${c.status}`,
    });
    // Both the old and the new linked story show (or stop showing) the closure
    await notifyClosuresChanged([await storySlug(context.env, c.articleId), await storySlug(context.env, existing.article_id)]);

    return jsonResponse({ success: true, id, status: c.status });
  } catch (err) {
    console.error('Failed to update closure:', err);
    if (isMissingClosuresTable(err)) return jsonResponse({ error: MISSING_TABLE_MESSAGE }, 503);
    return jsonResponse({ error: 'Failed to save the closure' }, 500);
  }
}

/** DELETE /api/admin/closures/<id>: remove a closure entered by mistake (Owner / Editor, as for deleting stories). */
export async function onRequestDelete(context: EventContext<Env, 'id', { user: User }>): Promise<Response> {
  const user = context.data.user;
  const roleErr = requireRole(user, ['Owner', 'Editor']);
  if (roleErr) return roleErr;

  try {
    const id = context.params.id as string;
    const existing = await context.env.DB.prepare('SELECT id, name, status, article_id FROM road_closures WHERE id = ?')
      .bind(id)
      .first<StoredClosure>();
    if (!existing) return jsonResponse({ error: 'Closure not found' }, 404);

    await context.env.DB.prepare('DELETE FROM road_closures WHERE id = ?').bind(id).run();
    await logAuditEvent(context.env, user, 'DELETE_CLOSURE', {
      articleId: existing.article_id,
      beforeStatus: existing.status,
      ip: getClientIp(context.request),
      details: `Deleted road closure "${existing.name}" (${id})`,
    });
    await notifyClosuresChanged([await storySlug(context.env, existing.article_id)]);
    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Failed to delete closure:', err);
    if (isMissingClosuresTable(err)) return jsonResponse({ error: MISSING_TABLE_MESSAGE }, 503);
    return jsonResponse({ error: 'Failed to delete the closure' }, 500);
  }
}
