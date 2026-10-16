import { Env, EventContext, User } from '../../../types';
import { sanitizePlainText } from '../../../utils/sanitize';
import { logAuditEvent, getClientIp, requireRole } from '../../../utils/auth';

export async function onRequestGet(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  const user = context.data.user;

  // Only Owner manages users
  const roleErr = requireRole(user, ['Owner']);
  if (roleErr) return roleErr;

  const { results } = await context.env.DB.prepare(
    'SELECT id, email, name, role, bio, photo, active, created_at FROM users ORDER BY created_at DESC'
  ).all<User>();

  return new Response(JSON.stringify({ users: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;

    // Only Owner manages users
    const roleErr = requireRole(user, ['Owner']);
    if (roleErr) return roleErr;

    const body = await context.request.json() as any;
    const email = body?.email?.trim().toLowerCase();
    const name = sanitizePlainText(body?.name || '', 100);
    const role = body?.role as 'Owner' | 'Editor' | 'Journalist' | 'Bot';
    const bio = sanitizePlainText(body?.bio || '', 300);
    const photo = body?.photo ? String(body.photo).trim() : null;

    if (!email || !name || !role) {
      return new Response(JSON.stringify({ error: 'Email, name, and role are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!['Owner', 'Editor', 'Journalist', 'Bot'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Role must be Owner, Editor, Journalist, or Bot' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await context.env.DB.prepare(`
      INSERT INTO users (id, email, name, role, bio, photo, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime("now"))
    `)
      .bind(id, email, name, role, bio, photo)
      .run();

    await logAuditEvent(
      context.env,
      user,
      'CREATE_USER',
      {
        articleId: null,
        beforeStatus: null,
        afterStatus: role,
        ip: getClientIp(context.request),
        details: `Added newsroom staff: ${name} (${email}) as ${role}`,
      }
    );

    return new Response(JSON.stringify({ success: true, id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Failed to create user:', err);
    const isDup = err?.message?.includes('UNIQUE constraint failed');
    return new Response(
      JSON.stringify({
        error: isDup ? 'A user with this email address already exists.' : 'Failed to create staff member.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
