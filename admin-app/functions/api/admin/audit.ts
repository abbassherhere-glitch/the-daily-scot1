import { Env, EventContext, User } from '../../types';
import { requireRole } from '../../utils/auth';

export async function onRequestGet(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  const user = context.data.user;

  // Bot and Journalist must be blocked from audit
  const roleErr = requireRole(user, ['Owner', 'Editor']);
  if (roleErr) return roleErr;

  const { results } = await context.env.DB.prepare(
    'SELECT id, user_id, user_email, action, article_id, before_status, after_status, ip, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT 150'
  ).all();

  return new Response(JSON.stringify({ logs: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
