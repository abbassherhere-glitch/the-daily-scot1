import { Article, CategoryType } from '../types/news';
import { INITIAL_ARTICLES, CATEGORIES } from '../data/mockArticles';

// Check if running in local development or AI Studio preview
const isDevOrPreview =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' &&
    (window.location.hostname.includes('.run.app') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1')));

const PREVIEW_ARTICLES_KEY = 'daily_scot_articles_preview_v3';
const PREVIEW_SUBSCRIBERS_KEY = 'daily_scot_subscribers_preview_v3';

let isLiveApiAvailable: boolean | null = null;

async function checkApiAvailability(): Promise<boolean> {
  if (isLiveApiAvailable !== null) return isLiveApiAvailable;
  try {
    const res = await fetch('/api/categories', { method: 'GET' });
    isLiveApiAvailable = res.ok;
    return res.ok;
  } catch {
    isLiveApiAvailable = false;
    return false;
  }
}

function getPreviewArticles(): Article[] {
  try {
    const raw = localStorage.getItem(PREVIEW_ARTICLES_KEY);
    if (!raw) {
      localStorage.setItem(PREVIEW_ARTICLES_KEY, JSON.stringify(INITIAL_ARTICLES));
      return INITIAL_ARTICLES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_ARTICLES;
  }
}

// -------------------------------------------------------------
// PUBLIC API CALLS (Read-only, Cloudflare Cached)
// -------------------------------------------------------------

export async function getCategories(): Promise<{ slug: string; name: string; description: string }[]> {
  const isLive = await checkApiAvailability();
  if (isLive) {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json() as any;
        return data.categories.map((c: any) => ({
          slug: c.slug,
          name: c.name,
          description: c.description,
        }));
      }
    } catch (e) {
      if (!isDevOrPreview) {
        throw new Error('Failed to retrieve categories from news API');
      }
      console.warn('Live categories failed, using fallback in dev', e);
    }
  }

  if (!isDevOrPreview) {
    throw new Error('Categories API is unavailable');
  }

  return CATEGORIES.map((c) => ({ slug: c.id, name: c.label, description: c.description }));
}

export async function getPublicArticles(params?: {
  category?: string;
  area?: string;
  featured?: boolean;
  breaking?: boolean;
  search?: string;
}): Promise<Article[]> {
  const isLive = await checkApiAvailability();

  if (isLive) {
    try {
      const query = new URLSearchParams();
      if (params?.category) query.set('category', params.category);
      if (params?.area) query.set('area', params.area);
      if (params?.featured) query.set('featured', 'true');
      if (params?.breaking) query.set('breaking', 'true');
      if (params?.search) query.set('search', params.search);

      const res = await fetch(`/api/articles?${query.toString()}`);
      if (!res.ok) {
        throw new Error(`Public articles API returned status HTTP ${res.status}`);
      }
      const data = await res.json() as any;
      return (data.articles || []).map((row: any) => transformD1RowToArticle(row));
    } catch (err) {
      // In production: NEVER show fake/mock stories! Throw proper error state.
      if (!isDevOrPreview) {
        console.error('Production articles fetch error:', err);
        throw err;
      }
      console.warn('Live articles API failed in preview/dev, using preview adapter', err);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Unable to connect to The Daily Scot news service. Please check your network connection.');
  }

  // Fallback Preview Adapter (ONLY in local development or AI Studio preview)
  let list = getPreviewArticles();
  if (params?.category && params.category !== 'all') {
    list = list.filter((a) => a.category === params.category);
  }
  if (params?.area && params.area !== 'All Glasgow' && params.area !== 'All') {
    list = list.filter((a) => a.locationTag?.toLowerCase() === params.area?.toLowerCase());
  }
  if (params?.featured) {
    list = list.filter((a) => a.isFeaturedLead);
  }
  if (params?.breaking) {
    list = list.filter((a) => a.isBreaking);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.standfirst.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  return list;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const isLive = await checkApiAvailability();

  if (isLive) {
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json() as any;
        return transformD1RowToArticle(data.article);
      }
      if (res.status === 404) {
        return null;
      }
      throw new Error(`Slug API returned status HTTP ${res.status}`);
    } catch (err) {
      if (!isDevOrPreview) {
        console.error('Production slug fetch error:', err);
        throw err;
      }
      console.warn('Live slug fetch failed in preview/dev', err);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Unable to connect to news service');
  }

  const list = getPreviewArticles();
  const match = list.find((a) => a.slug === slug || a.id === slug);
  return match || null;
}

export async function submitNewsletter(
  email: string,
  turnstileToken?: string
): Promise<{ success: boolean; message: string }> {
  const isLive = await checkApiAvailability();

  if (isLive) {
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstile_token: turnstileToken }),
      });
      if (res.ok) {
        return await res.json() as any;
      }
      const err = await res.json().catch(() => ({ error: 'Subscription failed' })) as any;
      throw new Error(err.error || `Subscription failed: HTTP ${res.status}`);
    } catch (e) {
      if (!isDevOrPreview) throw e;
      console.warn('Live newsletter failed, using preview fallback', e);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Newsletter service is currently unreachable.');
  }

  // Dev/Preview fallback
  const raw = localStorage.getItem(PREVIEW_SUBSCRIBERS_KEY);
  const subs = raw ? JSON.parse(raw) : [];
  if (!subs.some((s: any) => s.email === email)) {
    subs.unshift({ email, confirmed: 1, created_at: new Date().toISOString() });
    localStorage.setItem(PREVIEW_SUBSCRIBERS_KEY, JSON.stringify(subs));
  }
  return { success: true, message: 'Please check your email to confirm your subscription.' };
}

function parseBodyToBlocks(body: string): string[] {
  if (!body) return [];
  if (/<(p|h2|h3|blockquote|ul|ol|figure)[^>]*>/i.test(body)) {
    const blocks: string[] = [];
    const blockRegex = /<(p|h2|h3|blockquote|ul|ol|figure)[\s\S]*?<\/\1>/gi;
    let match;
    while ((match = blockRegex.exec(body)) !== null) {
      const blockHtml = match[0].trim();
      if (blockHtml) blocks.push(blockHtml);
    }
    if (blocks.length > 0) return blocks;
  }
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`));
}

// D1 returns timestamps as 'YYYY-MM-DD HH:MM:SS' (UTC). Convert to ISO so every browser parses them as UTC.
function toIsoDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value.replace(' ', 'T') + 'Z';
  }
  return value;
}

function transformD1RowToArticle(row: any): Article {
  let tags: string[] = [];
  try {
    tags = Array.isArray(row.tags)
      ? row.tags
      : row.tags?.startsWith('[')
      ? JSON.parse(row.tags)
      : (row.tags || '').split(',').map((t: string) => t.trim());
  } catch {
    tags = ['Glasgow'];
  }

  const contentParagraphs = parseBodyToBlocks(row.body || '');

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    category: row.category as CategoryType,
    subcategory: row.category_name || row.category,
    locationTag: row.area || undefined,
    // List endpoints omit the body; mark those as partial so the full story is fetched when opened.
    content: contentParagraphs,
    isPartial: typeof row.body !== 'string',
    author: {
      name: row.author_name || 'Staff Reporter',
      role: row.author_role || 'The Daily Scot Newsdesk',
      avatar: row.author_photo || '',
    },
    publishedAt: toIsoDate(row.published_at || row.created_at),
    updatedAt: row.updated_at ? toIsoDate(row.updated_at) : undefined,
    readTime: `${Math.max(2, Math.ceil((row.body || '').split(' ').length / 180))} min read`,
    heroImage: row.hero_image || '/placeholder-hero.svg',
    heroCaption: row.image_caption || '',
    heroCredit: row.photo_credit ? `Photograph: ${row.photo_credit}` : '',
    isBreaking: Boolean(row.is_breaking),
    isFeaturedLead: Boolean(row.is_featured),
    isTopStory: true,
    views: Number(row.total_views) || 0,
    comments: [],
    tags,
  };
}
