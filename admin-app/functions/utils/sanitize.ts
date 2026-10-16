// HTML & Input Sanitizer for Cloudflare Pages Functions
// Implements strict allow-list sanitization using Cloudflare HTMLRewriter

const ALLOWED_TAGS = new Set([
  'p',
  'h2',
  'h3',
  'strong',
  'em',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'figure',
  'figcaption',
  'img',
  'br',
]);

const DANGEROUS_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'svg',
  'canvas',
  'meta',
  'link',
  'base',
]);

class StrictSanitizerHandler {
  element(element: any) {
    const tagName = element.tagName.toLowerCase();

    if (DANGEROUS_ELEMENTS.has(tagName)) {
      element.remove();
      return;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      element.removeAndKeepContent();
      return;
    }

    const attributes = [...element.attributes];
    for (const [name, value] of attributes) {
      const attrName = name.toLowerCase();

      if (attrName.startsWith('on') || attrName === 'style') {
        element.removeAttribute(name);
        continue;
      }

      if (tagName === 'a') {
        if (attrName === 'href') {
          const trimmed = value.trim();
          if (/^(https?:\/\/|\/|mailto:|tel:)/i.test(trimmed) && !/^javascript:/i.test(trimmed)) {
            element.setAttribute('href', trimmed);
            element.setAttribute('rel', 'noopener noreferrer');
          } else {
            element.setAttribute('href', '#');
          }
        } else if (attrName !== 'title') {
          element.removeAttribute(name);
        }
      } else if (tagName === 'img') {
        if (attrName === 'src') {
          const trimmed = value.trim();
          if (/^(https?:\/\/|\/|data:image\/)/i.test(trimmed) && !/^javascript:/i.test(trimmed)) {
            element.setAttribute('src', trimmed);
          } else {
            element.removeAttribute('src');
          }
        } else if (attrName === 'alt') {
          element.setAttribute('alt', value.slice(0, 250));
        } else if (attrName !== 'title') {
          element.removeAttribute(name);
        }
      } else {
        element.removeAttribute(name);
      }
    }
  }
}

/**
 * Sanitizes rich article text or HTML using Cloudflare HTMLRewriter
 * Allows only: p, h2, h3, strong, em, a[href], ul, ol, li, blockquote, figure, figcaption, img[src,alt]
 */
export async function sanitizeHtml(input: string): Promise<string> {
  if (!input || typeof input !== 'string') return '';

  // @ts-ignore
  if (typeof HTMLRewriter !== 'undefined') {
    const res = new Response(input, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    // @ts-ignore
    const rewriter = new HTMLRewriter().on('*', new StrictSanitizerHandler());
    const transformed = rewriter.transform(res);
    return await transformed.text();
  }

  let clean = input
    .replace(/<(script|style|iframe|object|embed|form|input|button|svg|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|svg|meta|link)[^>]*\/>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s+on[a-z]+\s*=[^"'\s>]+/gi, '')
    .replace(/javascript:[^"'\s>]*/gi, '');

  return clean.trim();
}

export function sanitizePlainText(input: string, maxLength = 500): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}
