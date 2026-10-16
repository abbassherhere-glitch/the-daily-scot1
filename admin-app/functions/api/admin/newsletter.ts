import { Env, EventContext, User } from '../../types';
import { requireRole } from '../../utils/auth';

export async function onRequestGet(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  const user = context.data.user;

  // Bot and Journalist must be blocked from newsletter
  const roleErr = requireRole(user, ['Owner', 'Editor']);
  if (roleErr) return roleErr;

  const url = new URL(context.request.url);
  const format = url.searchParams.get('format');

  const { results } = await context.env.DB.prepare(
    'SELECT email, confirmed, created_at FROM newsletter_subscribers ORDER BY created_at DESC'
  ).all<{ email: string; confirmed: number; created_at: string }>();

  if (format === 'csv') {
    let csv = 'email,confirmed,created_at\r\n';
    results.forEach((row) => {
      csv += `"${row.email}",${row.confirmed},"${row.created_at}"\r\n`;
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="daily-scot-subscribers.csv"',
      },
    });
  }

  return new Response(JSON.stringify({ subscribers: results, count: results.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
