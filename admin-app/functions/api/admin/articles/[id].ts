import { Env, EventContext, User, ArticleRecord } from '../../../types';
import { sanitizeHtml, sanitizePlainText, generateSlug, sanitizeUrl, toSqlDateTime } from '../../../utils/sanitize';
import { logAuditEvent, getClientIp, requireRole } from '../../../utils/auth';
import {
  checkPublishRules,
  jsonResponse,
  normaliseLegalCheck,
  normaliseSourceType,
  normaliseStatus,
  restrictStatusForRole,
} from '../../../utils/articleRules';
import { displayByline, resolveByline } from '../../../utils/byline';


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

    const isEditor = user.role === 'Owner' || user.role === 'Editor';
    const body = (await context.request.json()) as any;

    const existing = await context.env.DB.prepare('SELECT * FROM articles WHERE id = ?')
      .bind(id)
      .first<ArticleRecord & { breaking_until?: string | null }>();

    if (!existing) return jsonResponse({ error: 'Article not found' }, 404);

    // Journalists can only edit their own articles
    if (user.role === 'Journalist' && existing.author_id !== user.id) {
      return jsonResponse({ error: 'Permission denied: Journalists may only edit their own articles' }, 403);
    }

    const title = sanitizePlainText(body.title || existing.title, 200);
    const cleanBody = body.body ? await sanitizeHtml(body.body) : existing.body;

    // RULE 4.1: A Journalist editing a LIVE story must not change the live version.
    // Their changes are stored as a proposal for an Editor to review and apply via "Restore".
    if (user.role === 'Journalist' && ['published', 'scheduled'].includes(existing.status)) {
      const revId = `rev-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      await context.env.DB.prepare(`
        INSERT INTO article_revisions (
          id, article_id, editor_email, previous_title, previous_body, change_summary, kind, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'proposal', datetime('now'))
      `)
        .bind(
          revId,
          id,
          user.email,
          title,
          cleanBody,
          sanitizePlainText(body.change_summary || `Proposed revision by ${user.name}`, 300)
        )
        .run();

      await logAuditEvent(context.env, user, 'SUBMIT_REVISION_FOR_REVIEW', {
        articleId: id,
        beforeStatus: existing.status,
        afterStatus: existing.status,
        ip: getClientIp(context.request),
        details: `Proposed changes to live story "${existing.title}" (${id}) – awaiting editor review (revision ${revId})`,
      });

      return jsonResponse(
        {
          success: true,
          id,
          status: existing.status,
          slug: existing.slug,
          proposal_id: revId,
          message: 'Your changes were submitted for editor review. The live story is unchanged until an editor applies them.',
        },
        202
      );
    }

    // Public credit line. Omitted = unchanged; re-sending the current byline is always accepted.
    // author_id (the real poster) is never changed by an edit.
    const bylineResult = await resolveByline(context.env, user, body.byline_choice, body.byline_guest_name, existing);
    if ('error' in bylineResult) return jsonResponse({ error: bylineResult.error }, 400);
    const byline = bylineResult.value;
    const bylineChanged = displayByline(existing) !== displayByline(byline) ||
      (existing.byline_user_id || null) !== (byline.byline_user_id || null);

    const standfirst = sanitizePlainText(body.standfirst || existing.standfirst, 400);
    const category = sanitizePlainText(body.category || existing.category, 50);
    const area = sanitizePlainText(body.area !== undefined ? body.area : existing.area || '', 50);

    let heroImage = existing.hero_image || null;
    if (body.hero_image !== undefined) {
      heroImage = body.hero_image ? sanitizeUrl(body.hero_image) : null;
      if (body.hero_image && !heroImage) {
        return jsonResponse({ error: 'Hero image must be an http(s) URL or an uploaded image path.' }, 400);
      }
    }

    const imageCaption = sanitizePlainText(body.image_caption !== undefined ? body.image_caption : existing.image_caption || '', 250);
    const photoCredit = sanitizePlainText(body.photo_credit !== undefined ? body.photo_credit : existing.photo_credit || '', 100);
    const photoSource = sanitizePlainText(body.photo_source !== undefined ? body.photo_source : existing.photo_source || '', 100);
    const slug = body.slug ? generateSlug(body.slug) || existing.slug : existing.slug;
    const tags =
      body.tags !== undefined
        ? Array.isArray(body.tags)
          ? JSON.stringify(body.tags.map((t: unknown) => sanitizePlainText(String(t), 40)).filter(Boolean).slice(0, 20))
          : sanitizePlainText(body.tags, 300)
        : existing.tags;
    const seoTitle = sanitizePlainText(body.seo_title || existing.seo_title || `${title} | The Daily Scot`, 150);
    const metaDescription = sanitizePlainText(body.meta_description || existing.meta_description || standfirst, 250);

    const sourceType = normaliseSourceType(
      body.source_type !== undefined ? body.source_type : existing.source_type,
      existing.source_type || 'Own reporting'
    );
    const sourceUrl =
      body.source_url !== undefined ? sanitizeUrl(body.source_url, 300) || '' : existing.source_url || '';
    const sourceName = sanitizePlainText(body.source_name !== undefined ? body.source_name : existing.source_name || '', 150);

    // Only Editors/Owners can mark a story verified or clear a legal flag
    const verified = isEditor && body.verified !== undefined ? (body.verified ? 1 : 0) : existing.verified || 0;
    const legalCheck = normaliseLegalCheck(
      body.legal_check !== undefined ? body.legal_check : existing.legal_check,
      existing.legal_check || 'none'
    );
    const legalChecked =
      isEditor && body.legal_checked !== undefined ? (body.legal_checked ? 1 : 0) : existing.legal_checked || 0;
    const embargoUntil =
      body.embargo_until !== undefined ? toSqlDateTime(body.embargo_until) : toSqlDateTime(existing.embargo_until);
    const correctionNote = sanitizePlainText(
      body.correction_note !== undefined ? body.correction_note : existing.correction_note || '',
      500
    );

    let status = restrictStatusForRole(user.role, normaliseStatus(body.status, existing.status));

    // Breaking / featured are Editor-only
    let isBreaking = isEditor
      ? body.is_breaking !== undefined
        ? body.is_breaking
          ? 1
          : 0
        : existing.is_breaking
      : 0;
    let breakingUntil: string | null = null;
    if (isBreaking) {
      breakingUntil =
        toSqlDateTime(body.breaking_until) ||
        toSqlDateTime(existing.breaking_until) ||
        toSqlDateTime(new Date(Date.now() + 6 * 60 * 60 * 1000));
    }
    const isFeatured = isEditor
      ? body.is_featured !== undefined
        ? body.is_featured
          ? 1
          : 0
        : existing.is_featured
      : 0;

    const nowSql = toSqlDateTime(new Date())!;
    let publishedAt = toSqlDateTime(existing.published_at);

    if (status === 'scheduled') {
      const requested = toSqlDateTime(body.published_at) || (existing.status === 'scheduled' ? publishedAt : null);
      if (!requested || requested <= nowSql) {
        return jsonResponse({ error: 'A scheduled story needs a "Publish at" time in the future.' }, 400);
      }
      publishedAt = requested;
    } else if (status === 'published' && existing.status !== 'published') {
      // Going live now (keep the original date when re-publishing a story that was live before)
      publishedAt = publishedAt && publishedAt <= nowSql && existing.status === 'unpublished' ? publishedAt : nowSql;
    }

    if (status === 'published' || status === 'scheduled') {
      const ruleError = checkPublishRules({
        legalCheck,
        legalChecked,
        embargoUntil,
        verified,
        sourceType,
        goLiveAt: status === 'published' ? nowSql : publishedAt!,
      });
      if (ruleError) return jsonResponse({ error: ruleError }, 400);
    }

    const statements = [];

    // Write an article_revisions snapshot on every edit of a live story
    if (existing.status === 'published' && (existing.title !== title || existing.body !== cleanBody)) {
      const revId = `rev-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      statements.push(
        context.env.DB.prepare(`
          INSERT INTO article_revisions (
            id, article_id, editor_email, previous_title, previous_body, change_summary, kind, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'snapshot', datetime('now'))
        `).bind(
          revId,
          id,
          user.email,
          existing.title,
          existing.body,
          sanitizePlainText(body.change_summary || `Revision by ${user.name} (${user.role})`, 300)
        )
      );
    }

    if (isFeatured === 1) {
      statements.push(
        context.env.DB.prepare('UPDATE articles SET is_featured = 0 WHERE is_featured = 1 AND id != ?').bind(id)
      );
    }

    statements.push(
      context.env.DB.prepare(`
        UPDATE articles SET
          slug = ?, title = ?, standfirst = ?, body = ?, category = ?, area = ?,
          hero_image = ?, image_caption = ?, photo_credit = ?, photo_source = ?,
          status = ?, is_breaking = ?, breaking_until = ?, is_featured = ?,
          tags = ?, seo_title = ?, meta_description = ?,
          source_type = ?, source_url = ?, source_name = ?, verified = ?,
          legal_check = ?, legal_checked = ?, embargo_until = ?, correction_note = ?,
          byline = ?, byline_slug = ?, byline_user_id = ?,
          last_updated_by = ?, published_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        slug, title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        status, isBreaking, breakingUntil, isFeatured,
        tags, seoTitle, metaDescription,
        sourceType, sourceUrl, sourceName, verified,
        legalCheck, legalChecked, embargoUntil, correctionNote,
        byline.byline, byline.byline_slug, byline.byline_user_id,
        user.email, publishedAt, id
      )
    );

    await context.env.DB.batch(statements);

    let action = 'UPDATE_ARTICLE';
    if (existing.status !== 'published' && status === 'published') action = 'PUBLISH_ARTICLE';
    else if (existing.status !== 'scheduled' && status === 'scheduled') action = 'SCHEDULE_ARTICLE';
    else if (existing.status === 'published' && status !== 'published') action = 'UNPUBLISH_ARTICLE';

    await logAuditEvent(context.env, user, action, {
      articleId: id,
      beforeStatus: existing.status,
      afterStatus: status,
      ip: getClientIp(context.request),
      details:
        `${action}: "${title}" (${id}) transitioned from ${existing.status} to ${status}` +
        (bylineChanged ? `; byline changed from "${displayByline(existing)}" to "${displayByline(byline)}"` : ''),
    });

    return jsonResponse({ success: true, id, status, slug });
  } catch (err: any) {
    console.error('Failed to update article:', err);
    const msg = String(err?.message || '');
    if (msg.includes('UNIQUE constraint failed')) {
      return jsonResponse({ error: 'Another article already uses this URL slug.' }, 409);
    }
    return jsonResponse({ error: 'Failed to update article' }, 500);
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
