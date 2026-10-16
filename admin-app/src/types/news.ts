export type CategoryType =
  | 'all'
  | 'news'
  | 'glasgow'
  | 'scotland'
  | 'politics'
  | 'business'
  | 'property'
  | 'sport'
  | 'whats-on'
  | 'opinion';

export type ArticleStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'published'
  | 'scheduled'
  | 'unpublished'
  | 'archived';

export interface Author {
  name: string;
  role: string;
  avatar: string;
}

export type SourceType =
  | 'Police Scotland'
  | 'Council'
  | 'Press release'
  | 'Court'
  | 'Own reporting'
  | 'Other outlet - follow-up';

export type LegalCheckType =
  | 'none'
  | 'contempt risk - active court case'
  | 'defamation risk'
  | 'anonymity required';

export interface Article {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  category: CategoryType;
  subcategory?: string;
  locationTag?: string;
  content: string[];
  rawBody?: string;
  author: Author;
  publishedAt: string;
  updatedAt?: string;
  readTime: string;
  heroImage: string;
  heroCaption: string;
  heroCredit?: string;
  photoCredit?: string;
  photoSource?: string;
  isBreaking?: boolean;
  isFeaturedLead?: boolean;
  isTopStory?: boolean;
  views: number;
  comments: any[];
  tags: string[];
  status?: ArticleStatus;
  sourceType?: SourceType;
  sourceUrl?: string;
  sourceName?: string;
  verified?: number;
  legalCheck?: LegalCheckType;
  legalChecked?: number;
  embargoUntil?: string;
  correctionNote?: string;
}

export interface ArticleRevision {
  id: string;
  article_id: string;
  editor_email: string;
  previous_title: string;
  previous_body: string;
  change_summary?: string;
  kind?: 'snapshot' | 'proposal' | 'applied';
  created_at: string;
}

export type UserRole = 'Owner' | 'Editor' | 'Journalist' | 'Bot';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  bio?: string;
  photo?: string;
  active: number;
  created_at?: string;
}

export interface AuditEntry {
  id: string;
  user_id?: string;
  user_email: string;
  action: string;
  article_id?: string;
  before_status?: string;
  after_status?: string;
  ip?: string;
  details?: string;
  created_at: string;
}

export interface SubscriberEntry {
  email: string;
  confirmed: number;
  created_at: string;
}
