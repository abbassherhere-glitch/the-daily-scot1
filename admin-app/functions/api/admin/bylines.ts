import { Env, EventContext, User } from '../../types';
import { getClientIp, logAuditEvent, requireRole } from '../../utils/auth';
import { jsonResponse } from '../../utils/articleRules';
import { displayByline, getBylineOptions, resolveByline, STAFF_BYLINE_SLUG, StoredByline } from '../../utils/byline';

/**
 * GET /api/admin/bylines – options for the story editor's Byline dropdown.
 * Returns ids and display names only (no emails), so Editors and Journalists can use it
 * even though the full staff list (/api/admin/users) is Owner-only.
 */
export async function onRequestGet(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  const user = context.data.user;
  const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
  if (roleErr) return roleErr;

  try {
    const { options, allowGuest } = await getBylineOptions(context.env, user);
    return jsonResponse({ options, allow_guest: allowGuest });
  } catch (err) {
    console.error('Byline options failed:', err);
    return jsonResponse({ error: 'Failed to load byline options' }, 500);
  }
}

/**
 * POST /api/admin/bylines – bulk change the byline on several stories (Owner / Editor only).
 * Body: { ids: string[], byline_choice: 'staff' | 'user:<id>' | 'guest', byline_guest_name?: string }
 * Only the byline columns change; author_id, status, dates and content are untouched.
 * Each changed story gets its own audit entry under the logged-in user.
 */
export async function onRequestPost(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  const user = context.data.user;
  const roleErr = requireRole(user, ['Owner', 'Editor']);
  if (roleErr) return roleErr;

  try {
    const body = (await context.request.json().catch(() => null)) as any;
    const ids: string[] = Array.isArray(body?.ids)
      ? [...new Set(body.ids.filter((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 100))] as string[]
      : [];
    if (ids.length === 0) return jsonResponse({ error: 'Select at least one story.' }, 400);
    if (ids.length > 100) return jsonResponse({ error: 'Change at most 100 stories at a time.' }, 400);
    if (!body?.byline_choice) return jsonResponse({ error: 'Choose a byline.' }, 400);

    const resolved = await resolveByline(context.env, user, body.byline_choice, body.byline_guest_name, null);
    if ('error' in resolved) return jsonResponse({ error: resolved.error }, 400);
    const next = resolved.value;

    const placeholders = ids.map(() => '?').join(', ');
    const { results: found } = await context.env.DB.prepare(
      `SELECT id, title, status, byline, byline_slug, byline_user_id FROM articles WHERE id IN (${placeholders})`
    )
      .bind(...ids)
      .all<{ id: string; title: string; status: string } & StoredByline>();

    const toChange = (found || []).filter(
      (a) =>
        (a.byline_slug || STAFF_BYLINE_SLUG) !== next.byline_slug ||
        (a.byline_user_id || null) !== next.byline_user_id ||
        displayByline(a) !== next.byline
    );

    if (toChange.length > 0) {
      await context.env.DB.batch(
        toChange.map((a) =>
          context.env.DB.prepare(
            "UPDATE articles SET byline = ?, byline_slug = ?, byline_user_id = ?, last_updated_by = ?, updated_at = datetime('now') WHERE id = ?"
          ).bind(next.byline, next.byline_slug, next.byline_user_id, user.email, a.id)
        )
      );

      const ip = getClientIp(context.request);
      for (const a of toChange) {
        await logAuditEvent(context.env, user, 'UPDATE_BYLINE', {
          articleId: a.id,
          beforeStatus: a.status,
          afterStatus: a.status,
          ip,
          details: `Bulk byline change on "${a.title}" (${a.id}): "${displayByline(a)}" -> "${next.byline}"`,
        });
      }
    }

    return jsonResponse({
      success: true,
      updated: toChange.length,
      unchanged: (found || []).length - toChange.length,
      not_found: ids.length - (found || []).length,
      byline: next.byline,
    });
  } catch (err) {
    console.error('Bulk byline update failed:', err);
    return jsonResponse({ error: 'Failed to update bylines' }, 500);
  }
}
