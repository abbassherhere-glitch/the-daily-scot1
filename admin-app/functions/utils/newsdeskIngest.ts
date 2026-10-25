import { ArticleRecord, Env, User } from '../types';
import { sanitizeHtml, sanitizePlainText, generateSlug, sanitizeUrl, toSqlDateTime } from './sanitize';
import { checkPublishRules, jsonResponse, normaliseLegalCheck, normaliseSourceType } from './articleRules';
import { getClientIp, logAuditEvent } from './auth';

/**
 * What the AI Newsdesk may ask of POST /api/admin/ingest once its request has passed the shared-secret
 * check (utils/newsdeskAuth.ts). Everything else about the endpoint is unchanged: requests that do not
 * carry a Newsdesk signature still go through Cloudflare Access and still land in `needs_review`.
 *
 * Body (JSON):
 *   action        "publish" | "unpublish" | "ping"                     required
 *   external_id   the Newsdesk article id, [A-Za-z0-9._-], max 100      required, except for "ping"
 *
 * action = "ping": answers { success: true, pong: true } and does nothing else (connection test).
 *
 * action = "publish": creates the story live, or updates it if this external_id was published before
 * (the story keeps its address). The website's own publish rules are applied again here.
 *   title            max 200                                              required
 *   standfirst       max 400                                              required
 *   body             HTML (p, h2, h3, strong, em, a, ul, ol, li, blockquote, figure, img); sanitised   required
 *   category         the section slug, must exist in `categories`        required
 *   area             max 50 (default "All Glasgow")
 *   slug             optional; made unique if taken; ignored on update
 *   hero_image       absolute https URL; needs photo_credit
 *   image_caption    max 250      photo_credit max 100      photo_source max 100
 *   tags             array of strings (max 20, 40 chars each) or a comma-separated string
 *   seo_title        max 150      meta_description max 250
 *   source_type      one of the site's source types (default "Press release")
 *   source_url       max 300      source_name max 150
 *   verified         0/1          legal_check  one of the site's legal flags (default "none")
 *   legal_checked    0/1          embargo_until  date-time
 *   is_breaking      0/1          breaking_until  date-time (default now + 6 h)       is_featured  0/1
 *
 * action = "unpublish": sets the story to `unpublished`, which removes it from the public site, feeds and
 * sitemaps. Only stories created through this path (ids starting "nd-") can be touched.
 */

const EXTERNAL_ID = /^[A-Za-z0-9._-]{1,100}$/;
const ID_PREFIX = 'nd-';

export function websiteIdFor(externalId: string): string {
  return `${ID_PREFIX}${externalId}`;
}

function tagsFrom(raw: unknown): string {
  if (Array.isArray(raw)) {
    return JSON.stringify(
      raw.map((t) => sanitizePlainText(String(t), 40)).filter(Boolean).slice(0, 20)
    );
  }
  return sanitizePlainText(typeof raw === 'string' ? raw : '', 300);
}

export async function handleNewsdeskIngest(
  request: Request,
  env: Env,
  user: User,
  rawBody: string
): Promise<Response> {
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Body must be valid JSON' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Body must be a JSON object' }, 400);
  }

  const action = body.action;
  // A signed no-op the Newsdesk uses to test the connection: it proves the secret matches and that
  // nothing (Cloudflare Access, a redirect) stands between the Newsdesk and this function.
  if (action === 'ping') {
    return jsonResponse({ success: true, pong: true });
  }
  if (action !== 'publish' && action !== 'unpublish') {
    return jsonResponse({ error: 'action must be "publish", "unpublish" or "ping"' }, 400);
  }
  const externalId = typeof body.external_id === 'string' ? body.external_id : '';
  if (!EXTERNAL_ID.test(externalId)) {
    return jsonResponse({ error: 'external_id is required (letters, digits, dot, dash, underscore; max 100)' }, 400);
  }
  const id = websiteIdFor(externalId);
  const ip = getClientIp(request);

  const existing = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
    .bind(id)
    .first<ArticleRecord>();

  // ------------------------------------------------------------------------------ unpublish
  if (action === 'unpublish') {
    if (!existing) return jsonResponse({ error: 'Article not found' }, 404);

    const liveStates = ['published', 'scheduled', 'approved'];
    if (!liveStates.includes(existing.status)) {
      return jsonResponse({ success: true, id, external_id: externalId, status: existing.status, unchanged: true });
    }

    await env.DB.prepare(
      "UPDATE articles SET status = 'unpublished', last_updated_by = ?, updated_at = datetime('now') WHERE id = ?"
    )
      .bind(user.email, id)
      .run();

    await logAuditEvent(env, user, 'NEWSDESK_UNPUBLISH_ARTICLE', {
      articleId: id,
      beforeStatus: existing.status,
      afterStatus: 'unpublished',
      ip,
      details: `Newsdesk unpublished "${existing.title}" (${id}, Newsdesk article ${externalId})`,
    });

    return jsonResponse({ success: true, id, external_id: externalId, status: 'unpublished' });
  }

  // -------------------------------------------------------------------------------- publish
  const title = sanitizePlainText(body.title || '', 200);
  const standfirst = sanitizePlainText(body.standfirst || '', 400);
  const cleanBody = await sanitizeHtml(typeof body.body === 'string' ? body.body : '');
  if (!title || !standfirst || !cleanBody) {
    return jsonResponse({ error: 'title, standfirst and body are required' }, 400);
  }

  const category = sanitizePlainText(body.category || '', 50);
  if (!category) return jsonResponse({ error: 'category (the section slug) is required' }, 400);
  const knownCategory = await env.DB.prepare('SELECT 1 AS ok FROM categories WHERE slug = ?')
    .bind(category)
    .first();
  if (!knownCategory) {
    return jsonResponse({ error: `Unknown section "${category}"` }, 422);
  }

  const area = sanitizePlainText(body.area || 'All Glasgow', 50);

  let heroImage: string | null = null;
  const rawHero = body.hero_image ? String(body.hero_image).trim() : '';
  if (rawHero) {
    heroImage = sanitizeUrl(rawHero);
    if (!heroImage || !heroImage.startsWith('https://')) {
      return jsonResponse({ error: 'hero_image must be an absolute https URL' }, 400);
    }
  }
  const imageCaption = sanitizePlainText(body.image_caption || '', 250);
  const photoCredit = sanitizePlainText(body.photo_credit || '', 100);
  const photoSource = sanitizePlainText(body.photo_source || '', 100);
  if (heroImage && !photoCredit) {
    return jsonResponse({ error: 'A hero image needs a photo_credit' }, 422);
  }

  const tags = tagsFrom(body.tags);
  const seoTitle = sanitizePlainText(body.seo_title || `${title} | The Daily Scot`, 150);
  const metaDescription = sanitizePlainText(body.meta_description || standfirst, 250);

  const sourceType = normaliseSourceType(body.source_type, 'Press release');
  const sourceUrl = sanitizeUrl(body.source_url, 300) || '';
  const sourceName = sanitizePlainText(body.source_name || 'AI Newsdesk', 150);
  const verified = body.verified ? 1 : 0;
  const legalCheck = normaliseLegalCheck(body.legal_check);
  const legalChecked = body.legal_checked ? 1 : 0;
  const embargoUntil = toSqlDateTime(body.embargo_until);
  const correctionNote = sanitizePlainText(body.correction_note || '', 500);

  const isBreaking = body.is_breaking ? 1 : 0;
  const breakingUntil = isBreaking
    ? toSqlDateTime(body.breaking_until) || toSqlDateTime(new Date(Date.now() + 6 * 60 * 60 * 1000))
    : null;
  const isFeatured = body.is_featured ? 1 : 0;

  const nowSql = toSqlDateTime(new Date())!;
  const ruleError = checkPublishRules({
    legalCheck,
    legalChecked,
    embargoUntil,
    verified,
    sourceType,
    goLiveAt: nowSql,
  });
  if (ruleError) return jsonResponse({ error: ruleError }, 422);

  const statements = [];

  if (isFeatured === 1) {
    statements.push(env.DB.prepare('UPDATE articles SET is_featured = 0 WHERE is_featured = 1 AND id != ?').bind(id));
  }

  let slug: string;
  let publishedAt = nowSql;

  if (existing) {
    // Same Newsdesk story again: update it in place and keep its address.
    slug = existing.slug;
    const previousPublishedAt = toSqlDateTime(existing.published_at);
    if (existing.status === 'published' && previousPublishedAt) {
      publishedAt = previousPublishedAt;
    } else if (existing.status === 'unpublished' && previousPublishedAt && previousPublishedAt <= nowSql) {
      publishedAt = previousPublishedAt;
    }

    if (existing.status === 'published' && (existing.title !== title || existing.body !== cleanBody)) {
      statements.push(
        env.DB.prepare(`
          INSERT INTO article_revisions (
            id, article_id, editor_email, previous_title, previous_body, change_summary, kind, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'snapshot', datetime('now'))
        `).bind(
          `rev-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          id,
          user.email,
          existing.title,
          existing.body,
          'Updated by the AI Newsdesk'
        )
      );
    }

    statements.push(
      env.DB.prepare(`
        UPDATE articles SET
          title = ?, standfirst = ?, body = ?, category = ?, area = ?,
          hero_image = ?, image_caption = ?, photo_credit = ?, photo_source = ?,
          status = 'published', is_breaking = ?, breaking_until = ?, is_featured = ?,
          tags = ?, seo_title = ?, meta_description = ?,
          source_type = ?, source_url = ?, source_name = ?, verified = ?,
          legal_check = ?, legal_checked = ?, embargo_until = ?, correction_note = ?,
          last_updated_by = ?, published_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        isBreaking, breakingUntil, isFeatured,
        tags, seoTitle, metaDescription,
        sourceType, sourceUrl, sourceName, verified,
        legalCheck, legalChecked, embargoUntil, correctionNote,
        user.email, publishedAt, id
      )
    );
  } else {
    slug = (body.slug ? generateSlug(String(body.slug)) : generateSlug(title)) || id;
    // Wire copy often repeats headlines: keep slugs unique instead of failing.
    const clash = await env.DB.prepare('SELECT 1 FROM articles WHERE slug = ?').bind(slug).first();
    if (clash) slug = `${slug.slice(0, 80)}-${crypto.randomUUID().slice(0, 6)}`;

    statements.push(
      env.DB.prepare(`
        INSERT INTO articles (
          id, slug, title, standfirst, body, category, area,
          hero_image, image_caption, photo_credit, photo_source,
          author_id, status, is_breaking, breaking_until, is_featured, tags,
          seo_title, meta_description,
          source_type, source_url, source_name, verified,
          legal_check, legal_checked, embargo_until, correction_note,
          last_updated_by, published_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 'published', ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, datetime('now'), datetime('now')
        )
      `).bind(
        id, slug, title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        user.id, isBreaking, breakingUntil, isFeatured, tags,
        seoTitle, metaDescription,
        sourceType, sourceUrl, sourceName, verified,
        legalCheck, legalChecked, embargoUntil, correctionNote,
        user.email, publishedAt
      )
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (err: any) {
    console.error('Newsdesk publish failed:', err);
    if (String(err?.message || '').includes('UNIQUE constraint failed')) {
      return jsonResponse({ error: 'Another article already uses this URL slug.' }, 409);
    }
    return jsonResponse({ error: 'Failed to publish article' }, 500);
  }

  await logAuditEvent(env, user, existing ? 'NEWSDESK_UPDATE_ARTICLE' : 'NEWSDESK_PUBLISH_ARTICLE', {
    articleId: id,
    beforeStatus: existing ? existing.status : null,
    afterStatus: 'published',
    ip,
    details: `Newsdesk ${existing ? 'updated' : 'published'} "${title}" (${id}, Newsdesk article ${externalId}) in section ${category}`,
  });

  return jsonResponse(
    {
      success: true,
      id,
      external_id: externalId,
      slug,
      status: 'published',
      published_at: publishedAt,
      path: `/news/${slug}`,
      created: !existing,
    },
    existing ? 200 : 201
  );
}
