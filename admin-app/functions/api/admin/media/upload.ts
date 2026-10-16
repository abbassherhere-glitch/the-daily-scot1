import { Env, EventContext, User } from '../../../types';
import { logAuditEvent, getClientIp, requireRole } from '../../../utils/auth';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function onRequestPost(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  try {
    const user = context.data.user;

    const roleErr = requireRole(user, ['Owner', 'Editor', 'Journalist']);
    if (roleErr) return roleErr;
    const contentType = context.request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Request must be multipart/form-data with a file field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate size (max 5MB)
    if (file.size > MAX_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds maximum permitted limit (5MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate mime type
    const fileType = file.type.toLowerCase();
    const extension = ALLOWED_TYPES[fileType];
    if (!extension) {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Allowed formats: JPG, PNG, WebP' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate clean, collision-free filename
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomHash = crypto.randomUUID().slice(0, 10);
    const key = `articles/${year}/${month}/scot-${Date.now()}-${randomHash}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();

    // Upload to Cloudflare R2 MEDIA bucket
    await context.env.MEDIA.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: fileType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        uploadedBy: user.email,
        originalName: file.name.slice(0, 50),
      },
    });

    const publicBase = context.env.MEDIA_PUBLIC_URL || '';
    const fileUrl = publicBase ? `${publicBase.replace(/\/+$/, '')}/${key}` : `/${key}`;

    await logAuditEvent(
      context.env,
      user,
      'UPLOAD_MEDIA',
      {
        articleId: null,
        beforeStatus: null,
        afterStatus: key,
        ip: getClientIp(context.request),
        details: `Uploaded image ${key} (${(file.size / 1024).toFixed(1)} KB)`,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        key,
        url: fileUrl,
        size: file.size,
        contentType: fileType,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('R2 upload error:', err);
    return new Response(JSON.stringify({ error: 'Media upload to R2 failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
