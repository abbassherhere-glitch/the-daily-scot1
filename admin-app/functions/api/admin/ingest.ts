import { Env, EventContext, User } from '../../types';
import { sanitizeHtml, sanitizePlainText, generateSlug, sanitizeUrl, detectImageType } from '../../utils/sanitize';
import { normaliseSourceType } from '../../utils/articleRules';
import { logAuditEvent, getClientIp, requireRole } from '../../utils/auth';
import { handleNewsdeskIngest } from '../../utils/newsdeskIngest';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for bot ingested media

export async function onRequestPost(
  context: EventContext<Env, any, { user: User; newsdeskBody?: string }>
): Promise<Response> {
  try {
    const user = context.data.user;

    // Allow Bot, Editor, Owner to ingest
    const roleErr = requireRole(user, ['Bot', 'Owner', 'Editor']);
    if (roleErr) return roleErr;

    // Signed AI Newsdesk request (verified by the middleware): may publish and unpublish its own stories.
    // Everything below this block is the original behaviour: stories always land in 'needs_review'.
    if (context.data.newsdeskBody !== undefined) {
      return await handleNewsdeskIngest(context.request, context.env, user, context.data.newsdeskBody);
    }

    const body = await context.request.json() as any;

    const title = sanitizePlainText(body.title || '', 200);
    const standfirst = sanitizePlainText(body.standfirst || '', 400);
    const rawBody = body.body || '';
    const cleanBody = await sanitizeHtml(rawBody);
    const category = sanitizePlainText(body.category || 'news', 50);
    const area = sanitizePlainText(body.area || 'All Glasgow', 50);
    const rawHeroImage = body.hero_image ? String(body.hero_image).trim() : '';
    let heroImage: string | null = null;
    const imageCaption = sanitizePlainText(body.image_caption || '', 250);
    const photoCredit = sanitizePlainText(body.photo_credit || 'Wire / Press Pool', 100);
    const photoSource = sanitizePlainText(body.photo_source || 'Syndicated Feed', 100);
    const customSlug = body.slug ? generateSlug(body.slug) : generateSlug(title);
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : sanitizePlainText(body.tags || '', 300);

    const sourceType = normaliseSourceType(body.source_type, 'Press release');
    const sourceUrl = sanitizeUrl(body.source_url, 300) || '';
    const sourceName = sanitizePlainText(body.source_name || 'Automated News Ingest Service', 150);

    if (!title || !standfirst || !cleanBody) {
      return new Response(
        JSON.stringify({ error: 'title, standfirst, and body are required for ingest' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Media: base64 data URLs are stored in R2 (D1 rows are limited to ~2MB); other values must be http(s) URLs
    if (rawHeroImage.startsWith('data:')) {
      const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(rawHeroImage);
      if (!match) {
        return new Response(JSON.stringify({ error: 'hero_image data URL must be a base64 JPEG, PNG or WebP' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const approxBytes = Math.floor((match[2].length * 3) / 4);
      if (approxBytes > MAX_IMAGE_SIZE_BYTES) {
        return new Response(
          JSON.stringify({ error: 'Ingested media image exceeds maximum allowed size (5MB)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      // Verify the decoded bytes really are an image (the data URL's declared type can be faked)
      const detected = detectImageType(bytes);
      if (!detected) {
        return new Response(JSON.stringify({ error: 'hero_image is not a valid JPG, PNG or WebP image' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const mime = detected.mime;
      const ext = detected.ext;
      const now = new Date();
      const key = `articles/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/ingest-${Date.now()}-${crypto.randomUUID().slice(0, 10)}.${ext}`;
      await context.env.MEDIA.put(key, bytes, {
        httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: { uploadedBy: user.email },
      });
      const publicBase = (context.env.MEDIA_PUBLIC_URL || '').replace(/\/+$/, '');
      heroImage = publicBase ? `${publicBase}/${key}` : `/${key}`;
    } else if (rawHeroImage) {
      heroImage = sanitizeUrl(rawHeroImage);
      if (!heroImage) {
        return new Response(JSON.stringify({ error: 'hero_image must be an http(s) URL or a base64 image data URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }


    const id = `ingest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    let slug = customSlug || id;
    // Wire copy often repeats headlines – keep slugs unique instead of failing
    const clash = await context.env.DB.prepare('SELECT 1 FROM articles WHERE slug = ?').bind(slug).first();
    if (clash) slug = `${slug.slice(0, 80)}-${crypto.randomUUID().slice(0, 6)}`;

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
        null, datetime('now'), datetime('now')
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
