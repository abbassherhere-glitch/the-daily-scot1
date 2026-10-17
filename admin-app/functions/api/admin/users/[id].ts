import { Env, EventContext, User } from '../../../types';
import { sanitizePlainText, sanitizeUrl } from '../../../utils/sanitize';
import { logAuditEvent, getClientIp, requireRole } from '../../../utils/auth';
import { generateSlug } from '../../../utils/sanitize';

export async function onRequestPut(
  context: EventContext<Env, 'id', { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;
    const id = context.params.id as string;

    // Only Owner manages users
    const roleErr = requireRole(user, ['Owner']);
    if (roleErr) return roleErr;

    const body = await context.request.json() as any;

    const existing = await context.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<User>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const name = sanitizePlainText(body.name || existing.name, 100);
    const role = (body.role || existing.role) as 'Owner' | 'Editor' | 'Journalist' | 'Bot';
    if (!['Owner', 'Editor', 'Journalist', 'Bot'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Role must be Owner, Editor, Journalist, or Bot' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const bio = sanitizePlainText(body.bio !== undefined ? body.bio : existing.bio || '', 300);
    const photo = body.photo !== undefined ? sanitizeUrl(body.photo) : existing.photo;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

    // Never leave the newsroom without an active Owner
    const losesOwner = existing.role === 'Owner' && existing.active === 1 && (role !== 'Owner' || active !== 1);
    if (losesOwner) {
      if (existing.id === user.id) {
        return new Response(
          JSON.stringify({ error: 'You cannot demote or deactivate your own Owner account. Ask another Owner.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const owners = await context.env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'Owner' AND active = 1"
      ).first<{ n: number }>();
      if (!owners || owners.n <= 1) {
        return new Response(JSON.stringify({ error: 'At least one active Owner is required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const statements = [
      context.env.DB.prepare(`
        UPDATE users SET name = ?, role = ?, bio = ?, photo = ?, active = ? WHERE id = ?
      `).bind(name, role, bio, photo, active, id),
    ];
    // Keep stories credited to this person in step with their new display name (and author page URL)
    const newSlug = generateSlug(name);
    if (name !== existing.name && newSlug) {
      statements.push(
        context.env.DB.prepare('UPDATE articles SET byline = ?, byline_slug = ? WHERE byline_user_id = ?').bind(name, newSlug, id)
      );
    }
    await context.env.DB.batch(statements);

    await logAuditEvent(
      context.env,
      user,
      'UPDATE_USER',
      {
        articleId: null,
        beforeStatus: existing.role,
        afterStatus: role,
        ip: getClientIp(context.request),
        details: `Updated user ${existing.email} (Role: ${role}, Active: ${active})`,
      }
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Failed to update user:', err);
    return new Response(JSON.stringify({ error: 'Failed to update user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
