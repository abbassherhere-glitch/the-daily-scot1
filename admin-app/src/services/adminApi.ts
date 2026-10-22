import { AdminUser, AuditEntry, BylineOption, STAFF_BYLINE, SubscriberEntry, UserRole } from '../types/news';

// Determine if we are in local development or a preview deployment
const isDevOrPreview =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' &&
    (window.location.hostname.includes('.run.app') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1')));

const PREVIEW_ROLE_KEY = 'daily_scot_admin_preview_role_v3';
const PREVIEW_ARTICLES_KEY = 'daily_scot_admin_articles_preview_v3';
const PREVIEW_USERS_KEY = 'daily_scot_admin_users_preview_v3';
const PREVIEW_AUDIT_KEY = 'daily_scot_admin_audit_preview_v3';

const DEFAULT_USERS: AdminUser[] = [
  {
    id: 'usr-owner-1',
    email: 'editor@dailyscot.co.uk',
    name: 'Callum MacIntyre',
    role: 'Owner',
    bio: 'Editor-in-Chief & Chief Infrastructure Correspondent.',
    photo: 'https://picsum.photos/seed/callum/240/240',
    active: 1,
  },
  {
    id: 'usr-editor-1',
    email: 'catriona@dailyscot.co.uk',
    name: 'Catriona Fraser',
    role: 'Editor',
    bio: 'Managing Editor & Heritage Architecture Correspondent.',
    photo: 'https://picsum.photos/seed/catriona/240/240',
    active: 1,
  },
  {
    id: 'usr-journo-1',
    email: 'morag@dailyscot.co.uk',
    name: 'Morag Campbell',
    role: 'Journalist',
    bio: 'Senior Columnist and East End chronicler.',
    photo: 'https://picsum.photos/seed/morag/240/240',
    active: 1,
  },
  {
    id: 'usr-journo-2',
    email: 'davie@dailyscot.co.uk',
    name: 'Davie Murdoch',
    role: 'Journalist',
    bio: 'Chief Football Writer & SPFL analyst.',
    photo: 'https://picsum.photos/seed/davie/240/240',
    active: 1,
  },
];

let isLiveApiAvailable: boolean | null = null;

async function checkLiveAdminApi(): Promise<boolean> {
  if (isLiveApiAvailable !== null) return isLiveApiAvailable;
  try {
    const res = await fetch('/api/admin/me');
    // If we get 200 or 401/403 with JSON, the Cloudflare Functions endpoint is live
    isLiveApiAvailable = res.status === 200 || res.status === 401 || res.status === 403;
    return isLiveApiAvailable;
  } catch {
    isLiveApiAvailable = false;
    return false;
  }
}

export function getActivePreviewRole(): UserRole {
  return (localStorage.getItem(PREVIEW_ROLE_KEY) as UserRole) || 'Owner';
}

export function setActivePreviewRole(role: UserRole): void {
  localStorage.setItem(PREVIEW_ROLE_KEY, role);
}

// ---------------------------------------------------------------------------
// ADMIN CURRENT USER
// ---------------------------------------------------------------------------
export async function getAdminCurrentUser(): Promise<AdminUser> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/me');
    if (res.ok) {
      const data = await res.json() as any;
      return data.user;
    }
    if (!isDevOrPreview) {
      if (res.status === 401) {
        throw new Error('Unauthorized: Cloudflare Access session missing or expired.');
      }
      if (res.status === 403) {
        throw new Error('Access Denied: Your account is not authorized for this newsroom.');
      }
      throw new Error(`Authentication service returned status ${res.status}`);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Cannot connect to Cloudflare Access Newsroom API. Please verify network or Cloudflare Zero Trust setup.');
  }

  // Local dev / preview fallback only
  const role = getActivePreviewRole();
  return DEFAULT_USERS.find((u) => u.role === role) || DEFAULT_USERS[0];
}

// ---------------------------------------------------------------------------
// ARTICLES CRUD
// ---------------------------------------------------------------------------
export async function getAdminArticles(params?: { status?: string; category?: string }): Promise<any[]> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.category) q.set('category', params.category);

    const res = await fetch(`/api/admin/articles?${q.toString()}`);
    if (res.ok) {
      const data = await res.json() as any;
      return data.articles;
    }
    if (!isDevOrPreview) {
      throw new Error(`Failed to load newsroom articles: HTTP ${res.status}`);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Unable to connect to The Daily Scot database. Production API is unavailable.');
  }

  // Preview fallback
  const raw = localStorage.getItem(PREVIEW_ARTICLES_KEY);
  let list = raw ? JSON.parse(raw) : [];
  if (params?.category && params.category !== 'all') {
    list = list.filter((a: any) => a.category === params.category);
  }
  if (params?.status && params.status !== 'all') {
    list = list.filter((a: any) => a.status === params.status);
  }
  return list;
}

export async function createAdminArticle(articleData: any): Promise<{ success: boolean; id: string; status: string; slug?: string }> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(articleData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create article' })) as any;
      throw new Error(err.error || `Publishing failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    // Strictly disallow fake local saving in production
    throw new Error('Production error: Cannot save article without connection to Cloudflare D1.');
  }

  // Preview Mode
  const id = `art-${Date.now()}`;
  const slug = articleData.slug || articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const user = await getAdminCurrentUser();

  let finalStatus = articleData.status || 'draft';
  if (user.role === 'Journalist' && (finalStatus === 'published' || finalStatus === 'approved')) {
    finalStatus = 'needs_review';
  }

  const raw = localStorage.getItem(PREVIEW_ARTICLES_KEY);
  const list = raw ? JSON.parse(raw) : [];
  const record = {
    ...articleData,
    id,
    slug,
    status: finalStatus,
    ...previewResolveByline(articleData.byline_choice, articleData.byline_guest_name),
    author_id: user.id,
    author_name: user.name,
    author_role: user.role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(PREVIEW_ARTICLES_KEY, JSON.stringify([record, ...list]));
  return { success: true, id, status: finalStatus, slug };
}

export async function updateAdminArticle(id: string, articleData: any): Promise<{ success: boolean; status: string; slug?: string }> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(articleData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update article' })) as any;
      throw new Error(err.error || `Update failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: Cannot update article without connection to Cloudflare D1.');
  }

  const raw = localStorage.getItem(PREVIEW_ARTICLES_KEY);
  const list = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex((a: any) => a.id === id);
  if (idx < 0) throw new Error('Article not found in preview cache');

  list[idx] = {
    ...list[idx],
    ...articleData,
    ...(articleData.byline_choice ? previewResolveByline(articleData.byline_choice, articleData.byline_guest_name) : {}),
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(PREVIEW_ARTICLES_KEY, JSON.stringify(list));

  return { success: true, status: list[idx].status, slug: list[idx].slug };
}

export async function deleteAdminArticle(id: string): Promise<{ success: boolean }> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete article' })) as any;
      throw new Error(err.error || `Delete failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: Cannot delete article without connection to Cloudflare D1.');
  }

  const raw = localStorage.getItem(PREVIEW_ARTICLES_KEY);
  const list = raw ? JSON.parse(raw) : [];
  localStorage.setItem(PREVIEW_ARTICLES_KEY, JSON.stringify(list.filter((a: any) => a.id !== id)));
  return { success: true };
}

// ---------------------------------------------------------------------------
// BYLINES
// ---------------------------------------------------------------------------

/** Preview mode only: turn a byline choice into the stored columns (the live server does this itself). */
function previewResolveByline(choice?: string, guestName?: string) {
  if (choice?.startsWith('user:')) {
    const u = DEFAULT_USERS.find((x) => x.id === choice.slice(5));
    if (u) return { byline: u.name, byline_user_id: u.id };
  }
  if (choice === 'guest' && guestName?.trim()) return { byline: guestName.trim(), byline_user_id: null };
  return { byline: STAFF_BYLINE, byline_user_id: null };
}

/** Options for the editor's Byline dropdown (validated again server-side on save). */
export async function getAdminBylineOptions(): Promise<{ options: BylineOption[]; allowGuest: boolean }> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/bylines');
    if (res.ok) {
      const data = (await res.json()) as any;
      return { options: data.options || [], allowGuest: Boolean(data.allow_guest) };
    }
    if (!isDevOrPreview) {
      throw new Error(`Failed to load byline options: HTTP ${res.status}`);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Unable to load byline options. Production API is unavailable.');
  }

  const me = await getAdminCurrentUser();
  const canCreditAnyone = me.role === 'Owner' || me.role === 'Editor';
  const people = canCreditAnyone ? DEFAULT_USERS.filter((u) => u.active && u.role !== 'Bot') : me.role === 'Journalist' ? [me] : [];
  return {
    options: [{ value: 'staff', label: STAFF_BYLINE }, ...people.map((u) => ({ value: `user:${u.id}`, label: u.name }))],
    allowGuest: canCreditAnyone,
  };
}

/** Owner/Editor: change the byline on several stories at once. */
export async function bulkUpdateBylines(
  ids: string[],
  bylineChoice: string,
  guestName?: string
): Promise<{ success: boolean; updated: number; unchanged: number; byline: string }> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/bylines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, byline_choice: bylineChoice, byline_guest_name: guestName }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Failed to update bylines' }))) as any;
      throw new Error(err.error || `Byline update failed: HTTP ${res.status}`);
    }
    return (await res.json()) as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: Cannot update bylines without connection to Cloudflare D1.');
  }

  const next = previewResolveByline(bylineChoice, guestName);
  const raw = localStorage.getItem(PREVIEW_ARTICLES_KEY);
  const list = raw ? JSON.parse(raw) : [];
  let updated = 0;
  for (const a of list) {
    if (ids.includes(a.id)) {
      Object.assign(a, next, { updated_at: new Date().toISOString() });
      updated++;
    }
  }
  localStorage.setItem(PREVIEW_ARTICLES_KEY, JSON.stringify(list));
  return { success: true, updated, unchanged: ids.length - updated, byline: next.byline };
}

// ---------------------------------------------------------------------------
// MEDIA UPLOAD (R2)
// ---------------------------------------------------------------------------
export async function uploadAdminMedia(file: File): Promise<{ success: boolean; url: string; key: string }> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image exceeds maximum allowed size of 5MB');
  }

  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/admin/media/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Media upload failed' })) as any;
      throw new Error(err.error || `Upload failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: Media upload requires active Cloudflare R2 binding.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        success: true,
        url: reader.result as string,
        key: `articles/preview/${Date.now()}-${file.name}`,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// USERS & RBAC
// ---------------------------------------------------------------------------
export async function getAdminUsers(): Promise<AdminUser[]> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json() as any;
      return data.users;
    }
    if (!isDevOrPreview) {
      throw new Error(`Failed to load newsroom users: HTTP ${res.status}`);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Production error: Cannot load user permissions from D1.');
  }

  const raw = localStorage.getItem(PREVIEW_USERS_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_USERS;
}

export async function createAdminUser(userData: { email: string; name: string; role: UserRole; bio?: string }): Promise<any> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add user' })) as any;
      throw new Error(err.error || `User creation failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: User administration requires Cloudflare D1 connection.');
  }

  const users = await getAdminUsers();
  const id = `usr-${Date.now()}`;
  const newUser: AdminUser = {
    id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    bio: userData.bio,
    active: 1,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(PREVIEW_USERS_KEY, JSON.stringify([newUser, ...users]));
  return { success: true, id };
}

export async function updateAdminUser(id: string, userData: Partial<AdminUser>): Promise<any> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update user' })) as any;
      throw new Error(err.error || `User update failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: User administration requires Cloudflare D1 connection.');
  }

  const users = await getAdminUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...userData };
    localStorage.setItem(PREVIEW_USERS_KEY, JSON.stringify(users));
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------------------------
export async function getAdminAuditLog(): Promise<AuditEntry[]> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    const res = await fetch('/api/admin/audit');
    if (res.ok) {
      const data = await res.json() as any;
      return data.logs;
    }
    if (!isDevOrPreview) {
      throw new Error(`Failed to load audit logs: HTTP ${res.status}`);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Production error: Audit logging requires Cloudflare D1 connection.');
  }

  const raw = localStorage.getItem(PREVIEW_AUDIT_KEY);
  return raw ? JSON.parse(raw) : [];
}

// ---------------------------------------------------------------------------
// SUBSCRIBERS
// ---------------------------------------------------------------------------
export async function getAdminSubscribers(format?: 'json' | 'csv'): Promise<any> {
  const isLive = await checkLiveAdminApi();

  if (isLive) {
    if (format === 'csv') {
      window.location.href = '/api/admin/newsletter?format=csv';
      return;
    }
    const res = await fetch('/api/admin/newsletter');
    if (res.ok) {
      const data = await res.json() as any;
      return data.subscribers;
    }
    if (!isDevOrPreview) {
      throw new Error(`Failed to load subscribers: HTTP ${res.status}`);
    }
  } else if (!isDevOrPreview) {
    throw new Error('Production error: Subscriber registry requires Cloudflare D1 connection.');
  }

  return [];
}

// ---------------------------------------------------------------------------
// ARTICLE REVISIONS & RESTORE
// ---------------------------------------------------------------------------
export async function getArticleRevisions(articleId: string): Promise<import('../types/news').ArticleRevision[]> {
  const isLive = await checkLiveAdminApi();
  if (isLive) {
    const res = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}/history`);
    if (res.ok) {
      const data = await res.json() as any;
      return data.revisions || [];
    }
  }
  return [];
}

export async function restoreArticleRevision(
  articleId: string,
  revisionId: string
): Promise<{ success: boolean; restored_title: string; restored_body: string }> {
  const isLive = await checkLiveAdminApi();
  if (isLive) {
    const res = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision_id: revisionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to restore revision' })) as any;
      throw new Error(err.error || `Restore failed: HTTP ${res.status}`);
    }
    return await res.json() as any;
  }

  if (!isDevOrPreview) {
    throw new Error('Production error: Cannot restore revision without connection to D1.');
  }

  return { success: true, restored_title: '', restored_body: '' };
}
