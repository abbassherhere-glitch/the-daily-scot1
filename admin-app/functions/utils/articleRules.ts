import { ArticleStatus, UserRole } from '../types';

export const VALID_STATUSES: ArticleStatus[] = [
  'draft',
  'needs_review',
  'approved',
  'published',
  'scheduled',
  'unpublished',
  'archived',
];

// Must match the CHECK constraints in migrations/0001_init.sql
export const VALID_SOURCE_TYPES = [
  'Police Scotland',
  'Council',
  'Press release',
  'Court',
  'Own reporting',
  'Other outlet - follow-up',
];

export const VALID_LEGAL_CHECKS = [
  'none',
  'contempt risk - active court case',
  'defamation risk',
  'anonymity required',
];

/** Statuses a Journalist may set on their own (non-published) article. */
export const JOURNALIST_STATUSES: ArticleStatus[] = ['draft', 'needs_review'];

export function normaliseStatus(value: unknown, fallback: ArticleStatus): ArticleStatus {
  return VALID_STATUSES.includes(value as ArticleStatus) ? (value as ArticleStatus) : fallback;
}

export function normaliseSourceType(value: unknown, fallback = 'Own reporting'): string {
  return VALID_SOURCE_TYPES.includes(value as string) ? (value as string) : fallback;
}

export function normaliseLegalCheck(value: unknown, fallback = 'none'): string {
  return VALID_LEGAL_CHECKS.includes(value as string) ? (value as string) : fallback;
}

/** Journalists and Bots can only draft or submit for review. */
export function restrictStatusForRole(role: UserRole, status: ArticleStatus): ArticleStatus {
  if (role === 'Journalist' || role === 'Bot') {
    return JOURNALIST_STATUSES.includes(status) ? status : 'needs_review';
  }
  return status;
}

export interface PublishCheckInput {
  legalCheck: string;
  legalChecked: number;
  embargoUntil: string | null; // SQLite UTC 'YYYY-MM-DD HH:MM:SS'
  verified: number;
  sourceType: string;
  goLiveAt: string; // SQLite UTC – when the story will actually appear
}

/**
 * Editorial rules that must pass before a story can go live, either immediately
 * ('published') or at a future time ('scheduled'). Returns an error message or null.
 */
export function checkPublishRules(input: PublishCheckInput): string | null {
  if (input.legalCheck !== 'none' && !input.legalChecked) {
    return `Cannot publish: Legal check flag "${input.legalCheck}" must be cleared (legal checked) first.`;
  }
  if (input.embargoUntil && input.embargoUntil > input.goLiveAt) {
    return `Cannot publish: Article is embargoed until ${input.embargoUntil} UTC.`;
  }
  if (!input.verified && input.sourceType !== 'Own reporting') {
    return `Cannot publish: Story sourced from "${input.sourceType}" must be marked as verified first.`;
  }
  return null;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
