import { Env, EventContext, User, ArticleRevision } from '../../../../types';
import { requireRole } from '../../../../utils/auth';

export async function onRequestGet(
  context: EventContext<Env, 'id', { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;
    const id = context.params.id as string;

    const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
    if (roleErr) return roleErr;

    const { results } = await context.env.DB.prepare(
      `SELECT id, article_id, editor_email, previous_title, previous_body, change_summary, kind, created_at 
       FROM article_revisions 
       WHERE article_id = ? 
       ORDER BY created_at DESC`
    )
      .bind(id)
      .all<ArticleRevision>();

    return new Response(JSON.stringify({ revisions: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Failed to fetch article revisions:', err);
    return new Response(JSON.stringify({ error: 'Failed to retrieve article revision history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
