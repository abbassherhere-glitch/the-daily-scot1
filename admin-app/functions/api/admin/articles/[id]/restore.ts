import { Env, EventContext, User, ArticleRecord, ArticleRevision } from '../../../../types';
import { requireRole, logAuditEvent, getClientIp } from '../../../../utils/auth';

export async function onRequestPost(
  context: EventContext<Env, 'id', { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;
    const id = context.params.id as string;

    // Only Editor or Owner can restore past revisions
    const roleErr = requireRole(user, ['Owner', 'Editor']);
    if (roleErr) return roleErr;

    const body = await context.request.json() as { revision_id?: string };
    if (!body?.revision_id) {
      return new Response(JSON.stringify({ error: 'revision_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the target revision
    const revision = await context.env.DB.prepare(
      'SELECT * FROM article_revisions WHERE id = ? AND article_id = ?'
    )
      .bind(body.revision_id, id)
      .first<ArticleRevision>();

    if (!revision) {
      return new Response(JSON.stringify({ error: 'Revision not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch existing article state
    const existing = await context.env.DB.prepare('SELECT * FROM articles WHERE id = ?')
      .bind(id)
      .first<ArticleRecord>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Archive current state into revisions before rolling back
    const snapshotId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await context.env.DB.prepare(`
      INSERT INTO article_revisions (
        id, article_id, editor_email, previous_title, previous_body, change_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))
    `)
      .bind(
        snapshotId,
        id,
        user.email,
        existing.title,
        existing.body,
        `Automatic backup before restoring revision ${body.revision_id}`
      )
      .run();

    // Restore title and body from the revision
    await context.env.DB.prepare(`
      UPDATE articles 
      SET title = ?, body = ?, last_updated_by = ?, updated_at = datetime("now") 
      WHERE id = ?
    `)
      .bind(revision.previous_title, revision.previous_body, user.email, id)
      .run();

    await logAuditEvent(
      context.env,
      user,
      'RESTORE_REVISION',
      {
        articleId: id,
        beforeStatus: existing.status,
        afterStatus: existing.status,
        ip: getClientIp(context.request),
        details: `Restored article "${existing.title}" (${id}) to revision ${body.revision_id}`,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        restored_title: revision.previous_title,
        restored_body: revision.previous_body,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Failed to restore revision:', err);
    return new Response(JSON.stringify({ error: 'Failed to restore article revision' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
