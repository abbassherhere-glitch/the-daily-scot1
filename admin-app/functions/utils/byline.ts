import { Env, User } from '../types';
import { generateSlug, sanitizePlainText } from './sanitize';

/**
 * Bylines: who a story is credited to on the public site.
 *
 * The editor sends a "byline choice":
 *   'staff'          -> The Daily Scot Staff (the newsdesk)
 *   'user:<user id>' -> an active staff member (never a Bot)
 *   'guest'          -> a free-text guest contributor name (byline_guest_name)
 *
 * The server resolves the choice into the three stored columns. Nothing the client sends is
 * stored directly: names and slugs always come from the users table or are re-derived here.
 * articles.author_id (the real poster) is never touched by any of this.
 */

export const STAFF_BYLINE = 'The Daily Scot Staff';
export const STAFF_BYLINE_SLUG = 'the-daily-scot-staff';

export interface ResolvedByline {
  byline: string | null;
  byline_slug: string | null;
  byline_user_id: string | null;
}

export interface BylineOption {
  value: string;
  label: string;
}

/** The byline currently stored on an article (NULL columns = the staff desk). */
export interface StoredByline {
  byline?: string | null;
  byline_slug?: string | null;
  byline_user_id?: string | null;
}

export const STAFF_RESOLVED: ResolvedByline = {
  byline: STAFF_BYLINE,
  byline_slug: STAFF_BYLINE_SLUG,
  byline_user_id: null,
};

/** Display name for a stored byline (falls back to the staff desk). */
export function displayByline(stored?: StoredByline | null): string {
  return (stored?.byline && stored.byline.trim()) || STAFF_BYLINE;
}

/** The choice value the editor should pre-select for a stored byline. */
export function bylineChoiceFor(stored?: StoredByline | null): string {
  if (stored?.byline_user_id) return `user:${stored.byline_user_id}`;
  if (stored?.byline && stored.byline_slug && stored.byline_slug !== STAFF_BYLINE_SLUG) return 'guest';
  return 'staff';
}

function canCreditAnyone(user: User): boolean {
  return user.role === 'Owner' || user.role === 'Editor';
}

/**
 * Options for the editor's Byline dropdown.
 * Owners and Editors: the staff desk, every active non-bot staff member, and "guest".
 * Journalists: the staff desk and themselves.
 */
export async function getBylineOptions(env: Env, user: User): Promise<{ options: BylineOption[]; allowGuest: boolean }> {
  const options: BylineOption[] = [{ value: 'staff', label: STAFF_BYLINE }];

  if (canCreditAnyone(user)) {
    const { results } = await env.DB.prepare(
      "SELECT id, name FROM users WHERE active = 1 AND role != 'Bot' ORDER BY name COLLATE NOCASE"
    ).all<{ id: string; name: string }>();
    for (const u of results || []) options.push({ value: `user:${u.id}`, label: u.name });
    return { options, allowGuest: true };
  }

  if (user.role === 'Journalist') {
    options.push({ value: `user:${user.id}`, label: user.name });
  }
  return { options, allowGuest: false };
}

/**
 * Validates the byline choice in a create/update request.
 *
 * - `choice` undefined on an update means "leave the byline as it is".
 * - `choice` undefined on a create means the default (the staff desk).
 * - Re-sending the article's current byline is always allowed, so a story credited to someone who has
 *   since been deactivated (or, for a Journalist, credited by an editor) can still be saved.
 */
export async function resolveByline(
  env: Env,
  user: User,
  choice: unknown,
  guestName: unknown,
  existing?: StoredByline | null
): Promise<{ value: ResolvedByline } | { error: string }> {
  const keep: ResolvedByline = {
    byline: existing?.byline ?? null,
    byline_slug: existing?.byline_slug ?? null,
    byline_user_id: existing?.byline_user_id ?? null,
  };

  if (choice === undefined || choice === null || choice === '') {
    return { value: existing ? keep : STAFF_RESOLVED };
  }
  if (typeof choice !== 'string') return { error: 'Invalid byline.' };

  if (choice === 'staff') return { value: STAFF_RESOLVED };

  if (choice.startsWith('user:')) {
    const userId = choice.slice(5);
    if (!userId) return { error: 'Invalid byline.' };

    // Unchanged byline on an existing story: keep it (even if that person is now inactive)
    if (existing?.byline_user_id && existing.byline_user_id === userId) return { value: keep };

    if (!canCreditAnyone(user) && userId !== user.id) {
      return { error: 'Journalists can credit a story to themselves or to The Daily Scot Staff only.' };
    }

    const credited = await env.DB.prepare('SELECT id, name, role, active FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; name: string; role: string; active: number }>();
    if (!credited || credited.active !== 1 || credited.role === 'Bot') {
      return { error: 'Byline must be an active newsroom staff member.' };
    }
    const slug = generateSlug(credited.name);
    if (!slug) return { error: 'This staff member\'s name cannot be used as a byline.' };
    return { value: { byline: credited.name, byline_slug: slug, byline_user_id: credited.id } };
  }

  if (choice === 'guest') {
    const name = sanitizePlainText(typeof guestName === 'string' ? guestName : '', 80).replace(/\s+/g, ' ');

    // Unchanged guest byline on an existing story
    if (existing && !existing.byline_user_id && existing.byline === name && bylineChoiceFor(existing) === 'guest') {
      return { value: keep };
    }

    if (!canCreditAnyone(user)) {
      return { error: 'Only Editors and Owners can credit a guest contributor.' };
    }
    if (name.length < 2 || !/\p{L}/u.test(name)) {
      return { error: 'Enter the guest contributor\'s name (at least 2 characters).' };
    }
    const slug = generateSlug(name);
    if (!slug) return { error: 'Guest contributor name must contain letters or numbers.' };
    if (slug === STAFF_BYLINE_SLUG) {
      return { error: `Choose "${STAFF_BYLINE}" from the list instead of typing it.` };
    }

    // A guest must not share an author page with a staff member
    const { results } = await env.DB.prepare("SELECT name FROM users WHERE role != 'Bot'").all<{ name: string }>();
    if ((results || []).some((u) => generateSlug(u.name) === slug)) {
      return { error: `"${name}" matches a staff member. Choose them from the Byline list instead.` };
    }
    return { value: { byline: name, byline_slug: slug, byline_user_id: null } };
  }

  return { error: 'Invalid byline.' };
}
