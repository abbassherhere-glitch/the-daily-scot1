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
        a.author_id, a.status, a.is_breaking, a.is_featured, a.tags,
        a.seo_title, a.meta_description,
        a.source_type, a.source_url, a.source_name, a.verified,
        a.legal_check, a.legal_checked, a.embargo_until, a.correction_note,
        a.published_at, a.created_at, a.updated_at,
        u.name AS author_name, u.email AS author_email, u.role AS author_role,
        c.name AS category_name
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

    return new Response(JSON.stringify({ articles: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Admin articles fetch failed:', err);
    return new Response(JSON.stringify({ error: 'Failed to retrieve newsroom articles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;

    // Bot cannot use regular create endpoint
    const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
    if (roleErr) return roleErr;

    const body = await context.request.json() as any;

    const title = sanitizePlainText(body.title || '', 200);
    const standfirst = sanitizePlainText(body.standfirst || '', 400);
    const rawBody = body.body || '';
    const cleanBody = await sanitizeHtml(rawBody);
    const category = sanitizePlainText(body.category || 'glasgow', 50);
    const area = sanitizePlainText(body.area || 'City Centre', 50);
    const heroImage = body.hero_image ? String(body.hero_image).trim() : null;
    const imageCaption = sanitizePlainText(body.image_caption || '', 250);
    const photoCredit = sanitizePlainText(body.photo_credit || '', 100);
    const photoSource = sanitizePlainText(body.photo_source || '', 100);
    const customSlug = body.slug ? generateSlug(body.slug) : generateSlug(title);
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : sanitizePlainText(body.tags || '', 300);
    const seoTitle = sanitizePlainText(body.seo_title || `${title} | The Daily Scot`, 150);
    const metaDescription = sanitizePlainText(body.meta_description || standfirst, 250);

    const sourceType = body.source_type || 'Own reporting';
    const sourceUrl = sanitizePlainText(body.source_url || '', 300);
    const sourceName = sanitizePlainText(body.source_name || '', 150);
    const verified = body.verified ? 1 : 0;
    const legalCheck = body.legal_check || 'none';
    const legalChecked = body.legal_checked ? 1 : 0;
    const embargoUntil = body.embargo_until || null;
    const correctionNote = sanitizePlainText(body.correction_note || '', 500);

    let requestedStatus: ArticleStatus = (body.status as ArticleStatus) || 'draft';
    if (!VALID_STATUSES.includes(requestedStatus)) {
      requestedStatus = 'draft';
    }

    let isBreaking = body.is_breaking ? 1 : 0;
    let breakingUntil: string | null = null;
    let isFeatured = body.is_featured ? 1 : 0;
    let publishedAt = body.published_at || null;

    // ROLE & PUBLISH ENFORCEMENT
    if (user.role === 'Journalist' || user.role === 'Bot') {
      // Journalists may only save as draft or submit for review (needs_review)
      if (requestedStatus === 'published' || requestedStatus === 'approved') {
        requestedStatus = 'needs_review';
      }
      isBreaking = 0;
      breakingUntil = null;
      isFeatured = 0;
      publishedAt = null;
    } else {
      // Owner or Editor
      if (isBreaking === 1) {
        breakingUntil = body.breaking_until || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      }
      if (requestedStatus === 'published') {
        // Enforce publish rules:
        // 1. Block if legal_check != 'none' and legal_checked = 0
        if (legalCheck !== 'none' && !legalChecked) {
          return new Response(
            JSON.stringify({
              error: `Cannot publish: Legal check flag "${legalCheck}" requires verification before publishing.`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // 2. Block if embargo_until > now
        if (embargoUntil && new Date(embargoUntil).getTime() > Date.now()) {
          return new Response(
            JSON.stringify({
              error: `Cannot publish: Article is embargoed until ${embargoUntil}.`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // 3. Block if verified = 0 and source_type != 'Own reporting'
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
    }

    if (!title || !standfirst || !cleanBody) {
      return new Response(JSON.stringify({ error: 'Title, standfirst, and body are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const finalSlug = customSlug || id;

    if (isFeatured === 1) {
      await context.env.DB.prepare('UPDATE articles SET is_featured = 0 WHERE is_featured = 1').run();
    }

    await context.env.DB.prepare(`
      INSERT INTO articles (
        id, slug, title, standfirst, body, category, area,
        hero_image, image_caption, photo_credit, photo_source,
        author_id, status, is_breaking, breaking_until, is_featured, tags,
        seo_title, meta_description,
        source_type, source_url, source_name, verified,
        legal_check, legal_checked, embargo_until, correction_note,
        published_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, datetime("now"), datetime("now")
      )
    `)
      .bind(
        id, finalSlug, title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        user.id, requestedStatus, isBreaking, breakingUntil, isFeatured, tags,
        seoTitle, metaDescription,
        sourceType, sourceUrl, sourceName, verified,
        legalCheck, legalChecked, embargoUntil, correctionNote,
        publishedAt
      )
      .run();

    await logAuditEvent(
      context.env,
      user,
      'CREATE_ARTICLE',
      {
        articleId: id,
        beforeStatus: null,
        afterStatus: requestedStatus,
        ip: getClientIp(context.request),
        details: `Created article "${title}" (${id}) with status ${requestedStatus}`,
      }
    );

    return new Response(JSON.stringify({ success: true, id, slug: finalSlug, status: requestedStatus }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Failed to create article:', err);
    const isUniqueViolation = err?.message?.includes('UNIQUE constraint failed');
    return new Response(
      JSON.stringify({
        error: isUniqueViolation ? 'An article with this URL slug already exists. Please pick a unique title or slug.' : 'Failed to save article.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
