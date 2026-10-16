import { Env, EventContext, User, ArticleRecord, ArticleStatus } from '../../../types';
import { sanitizeHtml, sanitizePlainText, generateSlug } from '../../../utils/sanitize';
import { logAuditEvent, getClientIp, requireRole } from '../../../utils/auth';

const VALID_STATUSES: ArticleStatus[] = [
  'draft',
  'needs_review',
  'approved',
  'published',
  'scheduled',
  'unpublished',
  'archived',
];

export async function onRequestGet(
  context: EventContext<Env, 'id', { user: User }>
): Promise<Response> {
  const user = context.data.user;

  const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
  if (roleErr) return roleErr;

  const id = context.params.id as string;
  const article = await context.env.DB.prepare(
    `SELECT a.*, u.name AS author_name, u.email AS author_email 
     FROM articles a 
     LEFT JOIN users u ON a.author_id = u.id 
     WHERE a.id = ?`
  )
    .bind(id)
    .first<ArticleRecord>();

  if (!article) {
    return new Response(JSON.stringify({ error: 'Article not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ article }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPut(
  context: EventContext<Env, 'id', { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;
    const id = context.params.id as string;

    const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
    if (roleErr) return roleErr;

    const body = await context.request.json() as any;

    const existing = await context.env.DB.prepare('SELECT * FROM articles WHERE id = ?')
      .bind(id)
      .first<ArticleRecord>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Role check: Journalists can only edit their own articles
    if (user.role === 'Journalist' && existing.author_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Permission denied: Journalists may only edit their own articles' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const title = sanitizePlainText(body.title || existing.title, 200);
    const standfirst = sanitizePlainText(body.standfirst || existing.standfirst, 400);
    const cleanBody = body.body ? await sanitizeHtml(body.body) : existing.body;
    const category = sanitizePlainText(body.category || existing.category, 50);
    const area = sanitizePlainText(body.area !== undefined ? body.area : existing.area || '', 50);
    const heroImage = body.hero_image !== undefined ? body.hero_image : existing.hero_image;
    const imageCaption = sanitizePlainText(body.image_caption !== undefined ? body.image_caption : existing.image_caption || '', 250);
    const photoCredit = sanitizePlainText(body.photo_credit !== undefined ? body.photo_credit : (existing.photo_credit || ''), 100);
    const photoSource = sanitizePlainText(body.photo_source !== undefined ? body.photo_source : (existing.photo_source || ''), 100);
    const slug = body.slug ? generateSlug(body.slug) : existing.slug;
    const tags = body.tags !== undefined ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : sanitizePlainText(body.tags, 300)) : existing.tags;
    const seoTitle = sanitizePlainText(body.seo_title || existing.seo_title || `${title} | The Daily Scot`, 150);
    const metaDescription = sanitizePlainText(body.meta_description || existing.meta_description || standfirst, 250);

    const sourceType = body.source_type !== undefined ? body.source_type : (existing.source_type || 'Own reporting');
    const sourceUrl = sanitizePlainText(body.source_url !== undefined ? body.source_url : (existing.source_url || ''), 300);
    const sourceName = sanitizePlainText(body.source_name !== undefined ? body.source_name : (existing.source_name || ''), 150);
    const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (existing.verified || 0);
    const legalCheck = body.legal_check !== undefined ? body.legal_check : (existing.legal_check || 'none');
    const legalChecked = body.legal_checked !== undefined ? (body.legal_checked ? 1 : 0) : (existing.legal_checked || 0);
    const embargoUntil = body.embargo_until !== undefined ? body.embargo_until : existing.embargo_until;
    const correctionNote = sanitizePlainText(body.correction_note !== undefined ? body.correction_note : (existing.correction_note || ''), 500);

    let status: ArticleStatus = (body.status as ArticleStatus) || existing.status;
    if (!VALID_STATUSES.includes(status)) {
      status = existing.status;
    }

    let isBreaking = body.is_breaking !== undefined ? (body.is_breaking ? 1 : 0) : existing.is_breaking;
    let breakingUntil = body.breaking_until !== undefined ? body.breaking_until : (existing as any).breaking_until;

    // Only Editor/Owner can set breaking. Journalist and Bot can't.
    if (user.role === 'Journalist' || user.role === 'Bot') {
      isBreaking = 0;
      breakingUntil = null;
    } else if (isBreaking === 1 && !breakingUntil) {
      // When an Editor/Owner ticks "Breaking", default breaking_until to now + 6 hours
      breakingUntil = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    } else if (isBreaking === 0) {
      breakingUntil = null;
    }

    let isFeatured = body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : existing.is_featured;
    let publishedAt = existing.published_at;

    // RULE 4.1: Journalists cannot edit published articles (create a needs_review revision instead)
    if (existing.status === 'published' && user.role === 'Journalist') {
      // 1. Snapshot previous published version into article_revisions
      const revId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await context.env.DB.prepare(`
        INSERT INTO article_revisions (
          id, article_id, editor_email, previous_title, previous_body, change_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))
      `)
        .bind(
          revId,
          id,
          user.email,
          existing.title,
          existing.body,
          body.change_summary || `Proposed revision by Journalist ${user.name}`
        )
        .run();

      // 2. Transition article to needs_review for editors to approve
      status = 'needs_review';
      isBreaking = 0;
      isFeatured = 0;
    } else if (existing.status === 'published') {
      // Editor or Owner editing an already published article:
      // "Write an article_revisions row on every edit of a published article;"
      const revId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await context.env.DB.prepare(`
        INSERT INTO article_revisions (
          id, article_id, editor_email, previous_title, previous_body, change_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))
      `)
        .bind(
          revId,
          id,
          user.email,
          existing.title,
          existing.body,
          body.change_summary || `Revision by ${user.name} (${user.role})`
        )
        .run();
    }

    // RULE 4.2: Role restrictions on publishing
    if (user.role === 'Journalist') {
      if (status === 'published' || status === 'approved') {
        status = 'needs_review';
      }
      isBreaking = 0;
      isFeatured = 0;
    }

    // RULE 4.3: Enforce strict publish rules when status === 'published'
    if (status === 'published') {
      if (user.role !== 'Owner' && user.role !== 'Editor') {
        return new Response(
          JSON.stringify({ error: 'Permission denied: Only Editors or Owners can publish articles' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Block if legal_check != 'none' and legal_checked = 0
      if (legalCheck !== 'none' && !legalChecked) {
        return new Response(
          JSON.stringify({
            error: `Cannot publish: Legal check flag "${legalCheck}" has not been approved (legal_checked = 0).`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Block if embargo_until > now
      if (embargoUntil && new Date(embargoUntil).getTime() > Date.now()) {
        return new Response(
          JSON.stringify({
            error: `Cannot publish: Article is embargoed until ${embargoUntil}.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Block if verified = 0 and source_type != 'Own reporting'
      if (!verified && sourceType !== 'Own reporting') {
        return new Response(
          JSON.stringify({
            error: `Cannot publish: Story sourced from "${sourceType}" must be marked as verified before publishing.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!publishedAt) {
        publishedAt = new Date().toISOString();
      }
    }

    if (isFeatured === 1) {
      await context.env.DB.prepare('UPDATE articles SET is_featured = 0 WHERE is_featured = 1 AND id != ?')
        .bind(id)
        .run();
    }

    await context.env.DB.prepare(`
      UPDATE articles SET
        slug = ?, title = ?, standfirst = ?, body = ?, category = ?, area = ?,
        hero_image = ?, image_caption = ?, photo_credit = ?, photo_source = ?,
        status = ?, is_breaking = ?, breaking_until = ?, is_featured = ?,
        tags = ?, seo_title = ?, meta_description = ?,
        source_type = ?, source_url = ?, source_name = ?, verified = ?,
        legal_check = ?, legal_checked = ?, embargo_until = ?, correction_note = ?,
        last_updated_by = ?, published_at = ?, updated_at = datetime("now")
      WHERE id = ?
    `)
      .bind(
        slug, title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        status, isBreaking, breakingUntil, isFeatured,
        tags, seoTitle, metaDescription,
        sourceType, sourceUrl, sourceName, verified,
        legalCheck, legalChecked, embargoUntil, correctionNote,
        user.email, publishedAt, id
      )
      .run();

    // Determine audit action
    let action = 'UPDATE_ARTICLE';
    if (existing.status !== 'published' && status === 'published') {
      action = 'PUBLISH_ARTICLE';
    } else if (existing.status === 'published' && status !== 'published') {
      action = 'UNPUBLISH_ARTICLE';
    } else if (existing.status === 'published' && user.role === 'Journalist') {
      action = 'SUBMIT_REVISION_FOR_REVIEW';
    }

    await logAuditEvent(
      context.env,
      user,
      action,
      {
        articleId: id,
        beforeStatus: existing.status,
        afterStatus: status,
        ip: getClientIp(context.request),
        details: `${action}: "${title}" (${id}) transitioned from ${existing.status} to ${status}`,
      }
    );

    return new Response(JSON.stringify({ success: true, id, status, slug }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Failed to update article:', err);
    return new Response(JSON.stringify({ error: 'Failed to update article' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete(
  context: EventContext<Env, 'id', { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;
    const id = context.params.id as string;

    // Bot and Journalist must be blocked from delete
    const roleErr = requireRole(user, ['Owner', 'Editor']);
    if (roleErr) return roleErr;

    const existing = await context.env.DB.prepare('SELECT title, status FROM articles WHERE id = ?')
      .bind(id)
      .first<{ title: string; status: string }>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await context.env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();

    await logAuditEvent(
      context.env,
      user,
      'DELETE_ARTICLE',
      {
        articleId: id,
        beforeStatus: existing.status,
        afterStatus: 'deleted',
        ip: getClientIp(context.request),
        details: `Deleted article "${existing.title}" (${id})`,
      }
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Failed to delete article:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete article' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
