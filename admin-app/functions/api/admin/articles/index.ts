import { Env, EventContext, User, ArticleRecord, ArticleStatus } from '../../../types';
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
import { resolveByline } from '../../../utils/byline';

export async function onRequestGet(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;

    // Bot cannot access articles list directly
    const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
    if (roleErr) return roleErr;

    const url = new URL(context.request.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const authorId = url.searchParams.get('author_id');

    let query = `
      SELECT
        a.id, a.slug, a.title, a.standfirst, a.body, a.category, a.area,
        a.hero_image, a.image_caption, a.photo_credit, a.photo_source,
        a.author_id, a.status, a.is_breaking, a.breaking_until, a.is_featured, a.tags,
        a.seo_title, a.meta_description,
        a.source_type, a.source_url, a.source_name, a.verified,
        a.legal_check, a.legal_checked, a.embargo_until, a.correction_note,
        a.published_at, a.created_at, a.updated_at,
        a.byline, a.byline_slug, a.byline_user_id,
        u.name AS author_name, u.email AS author_email, u.role AS author_role,
        c.name AS category_name,
        (SELECT COUNT(*) FROM article_revisions r WHERE r.article_id = a.id AND r.kind = 'proposal') AS pending_proposals
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category = c.slug
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (category && category !== 'all') {
      query += ' AND a.category = ?';
      params.push(category);
    }
    if (authorId) {
      query += ' AND a.author_id = ?';
      params.push(authorId);
    }

    query += ' ORDER BY a.updated_at DESC';

    const { results } = await context.env.DB.prepare(query).bind(...params).all<ArticleRecord>();

    return jsonResponse({ articles: results });
  } catch (err: any) {
    console.error('Admin articles fetch failed:', err);
    return jsonResponse({ error: 'Failed to retrieve newsroom articles' }, 500);
  }
}

export async function onRequestPost(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;

    // Bot cannot use regular create endpoint (it uses /api/admin/ingest)
    const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
    if (roleErr) return roleErr;

    const body = (await context.request.json()) as any;
    const isEditor = user.role === 'Owner' || user.role === 'Editor';

    const title = sanitizePlainText(body.title || '', 200);
    const standfirst = sanitizePlainText(body.standfirst || '', 400);
    const cleanBody = await sanitizeHtml(body.body || '');
    const category = sanitizePlainText(body.category || 'glasgow', 50);
    const area = sanitizePlainText(body.area || 'City Centre', 50);
    const heroImage = sanitizeUrl(body.hero_image);
    if (body.hero_image && !heroImage) {
      return jsonResponse({ error: 'Hero image must be an http(s) URL or an uploaded image path.' }, 400);
    }
    const imageCaption = sanitizePlainText(body.image_caption || '', 250);
    const photoCredit = sanitizePlainText(body.photo_credit || '', 100);
    const photoSource = sanitizePlainText(body.photo_source || '', 100);
    const customSlug = body.slug ? generateSlug(body.slug) : generateSlug(title);
    const tags = Array.isArray(body.tags)
      ? JSON.stringify(body.tags.map((t: unknown) => sanitizePlainText(String(t), 40)).filter(Boolean).slice(0, 20))
      : sanitizePlainText(body.tags || '', 300);
    const seoTitle = sanitizePlainText(body.seo_title || `${title} | The Daily Scot`, 150);
    const metaDescription = sanitizePlainText(body.meta_description || standfirst, 250);

    const sourceType = normaliseSourceType(body.source_type);
    const sourceUrl = sanitizeUrl(body.source_url, 300) || '';
    const sourceName = sanitizePlainText(body.source_name || '', 150);
    const verified = isEditor && body.verified ? 1 : 0;
    const legalCheck = normaliseLegalCheck(body.legal_check);
    // Only Editors/Owners can clear a legal flag
    const legalChecked = isEditor && body.legal_checked ? 1 : 0;
    const embargoUntil = toSqlDateTime(body.embargo_until);
    const correctionNote = sanitizePlainText(body.correction_note || '', 500);

    let status: ArticleStatus = restrictStatusForRole(user.role, normaliseStatus(body.status, 'draft'));

    let isBreaking = isEditor && body.is_breaking ? 1 : 0;
    let breakingUntil: string | null = null;
    const isFeatured = isEditor && body.is_featured ? 1 : 0;
    let publishedAt: string | null = null;
    const nowSql = toSqlDateTime(new Date())!;

    if (isBreaking) {
      breakingUntil = toSqlDateTime(body.breaking_until) || toSqlDateTime(new Date(Date.now() + 6 * 60 * 60 * 1000));
    }

    if (!title || !standfirst || !cleanBody) {
      return jsonResponse({ error: 'Title, standfirst, and body are required' }, 400);
    }

    // Public credit line (validated server-side; defaults to The Daily Scot Staff).
    // author_id below always stays the logged-in user who really created the story.
    const bylineResult = await resolveByline(context.env, user, body.byline_choice, body.byline_guest_name, null);
    if ('error' in bylineResult) return jsonResponse({ error: bylineResult.error }, 400);
    const byline = bylineResult.value;

    if (status === 'scheduled') {
      publishedAt = toSqlDateTime(body.published_at);
      if (!publishedAt || publishedAt <= nowSql) {
        return jsonResponse({ error: 'A scheduled story needs a "Publish at" time in the future.' }, 400);
      }
    } else if (status === 'published') {
      publishedAt = nowSql;
    }

    if (status === 'published' || status === 'scheduled') {
      const ruleError = checkPublishRules({
        legalCheck,
        legalChecked,
        embargoUntil,
        verified,
        sourceType,
        goLiveAt: publishedAt!,
      });
      if (ruleError) return jsonResponse({ error: ruleError }, 400);
    }

    const id = `art-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const finalSlug = customSlug || id;

    const statements = [];
    if (isFeatured === 1) {
      statements.push(context.env.DB.prepare('UPDATE articles SET is_featured = 0 WHERE is_featured = 1'));
    }
    statements.push(
      context.env.DB.prepare(`
        INSERT INTO articles (
          id, slug, title, standfirst, body, category, area,
          hero_image, image_caption, photo_credit, photo_source,
          author_id, status, is_breaking, breaking_until, is_featured, tags,
          seo_title, meta_description,
          source_type, source_url, source_name, verified,
          legal_check, legal_checked, embargo_until, correction_note,
          byline, byline_slug, byline_user_id,
          last_updated_by, published_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, datetime('now'), datetime('now')
        )
      `).bind(
        id, finalSlug, title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        user.id, status, isBreaking, breakingUntil, isFeatured, tags,
        seoTitle, metaDescription,
        sourceType, sourceUrl, sourceName, verified,
        legalCheck, legalChecked, embargoUntil, correctionNote,
        byline.byline, byline.byline_slug, byline.byline_user_id,
        user.email, publishedAt
      )
    );
    await context.env.DB.batch(statements);

    await logAuditEvent(context.env, user, 'CREATE_ARTICLE', {
      articleId: id,
      beforeStatus: null,
      afterStatus: status,
      ip: getClientIp(context.request),
      details: `Created article "${title}" (${id}) with status ${status}, credited to "${byline.byline}"`,
    });

    return jsonResponse({ success: true, id, slug: finalSlug, status }, 201);
  } catch (err: any) {
    console.error('Failed to create article:', err);
    const msg = String(err?.message || '');
    if (msg.includes('UNIQUE constraint failed')) {
      return jsonResponse({ error: 'An article with this URL slug already exists. Please pick a unique title or slug.' }, 409);
    }
    if (msg.includes('FOREIGN KEY constraint failed')) {
      return jsonResponse({ error: 'Unknown category. Make sure migrations/0002 has been applied.' }, 400);
    }
    return jsonResponse({ error: 'Failed to save article.' }, 500);
  }
}
