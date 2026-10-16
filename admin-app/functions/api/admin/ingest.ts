import { Env, EventContext, User } from '../../types';
import { sanitizeHtml, sanitizePlainText, generateSlug } from '../../utils/sanitize';
import { logAuditEvent, getClientIp, requireRole } from '../../utils/auth';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for bot ingested media

export async function onRequestPost(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;

    // Allow Bot, Editor, Owner to ingest
    const roleErr = requireRole(user, ['Bot', 'Owner', 'Editor']);
    if (roleErr) return roleErr;

    const body = await context.request.json() as any;

    const title = sanitizePlainText(body.title || '', 200);
    const standfirst = sanitizePlainText(body.standfirst || '', 400);
    const rawBody = body.body || '';
    const cleanBody = await sanitizeHtml(rawBody);
    const category = sanitizePlainText(body.category || 'news', 50);
    const area = sanitizePlainText(body.area || 'All Glasgow', 50);
    let heroImage = body.hero_image ? String(body.hero_image).trim() : null;
    const imageCaption = sanitizePlainText(body.image_caption || '', 250);
    const photoCredit = sanitizePlainText(body.photo_credit || 'Wire / Press Pool', 100);
    const photoSource = sanitizePlainText(body.photo_source || 'Syndicated Feed', 100);
    const customSlug = body.slug ? generateSlug(body.slug) : generateSlug(title);
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : sanitizePlainText(body.tags || '', 300);

    const sourceType = body.source_type || 'Press release';
    const sourceUrl = sanitizePlainText(body.source_url || '', 300);
    const sourceName = sanitizePlainText(body.source_name || 'Automated News Ingest Service', 150);

    // Bot media payload validation (if base64 data URL provided)
    if (heroImage && heroImage.startsWith('data:')) {
      const approxBytes = Math.ceil((heroImage.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_SIZE_BYTES) {
        return new Response(
          JSON.stringify({ error: 'Ingested media image exceeds maximum allowed size (5MB)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!title || !standfirst || !cleanBody) {
      return new Response(
        JSON.stringify({ error: 'title, standfirst, and body are required for ingest' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const slug = customSlug || id;

    // INGEST RULE: Bot articles CANNOT be published directly. ALWAYS 'needs_review'.
    const forcedStatus = 'needs_review';
    const verified = 0;
    const legalChecked = 0;

    await context.env.DB.prepare(`
      INSERT INTO articles (
        id, slug, title, standfirst, body, category, area,
        hero_image, image_caption, photo_credit, photo_source,
        author_id, status, is_breaking, is_featured, tags,
        seo_title, meta_description,
        source_type, source_url, source_name, verified,
        legal_check, legal_checked, embargo_until,
        published_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 0, 0, ?,
        ?, ?,
        ?, ?, ?, ?,
        'none', ?, null,
        null, datetime("now"), datetime("now")
      )
    `)
      .bind(
        id, slug, title, standfirst, cleanBody, category, area,
        heroImage, imageCaption, photoCredit, photoSource,
        user.id, forcedStatus, tags,
        `${title} | The Daily Scot`, standfirst,
        sourceType, sourceUrl, sourceName, verified,
        legalChecked
      )
      .run();

    await logAuditEvent(
      context.env,
      user,
      'BOT_INGEST_ARTICLE',
      {
        articleId: id,
        beforeStatus: null,
        afterStatus: forcedStatus,
        ip: getClientIp(context.request),
        details: `Bot "${user.name}" (${user.email}) ingested wire story "${title}" (${id}) into needs_review queue`,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        id,
        slug,
        status: forcedStatus,
        message: 'Story successfully ingested into newsroom needs_review queue',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Bot ingest error:', err);
    return new Response(JSON.stringify({ error: 'Failed to ingest article' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
