// Cloudflare Pages Functions Type Definitions for Admin Project

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: any }>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<any[]>;
  exec(query: string): Promise<any>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
}

export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: any): Promise<R2Object>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
}

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_SERVICE_CLIENT_ID?: string;
  CF_ACCESS_SERVICE_CLIENT_SECRET?: string;
  BOT_CLIENT_ID?: string;
  MEDIA_PUBLIC_URL?: string;
  NODE_ENV?: string;
  ENVIRONMENT?: string;
}

export type UserRole = 'Owner' | 'Editor' | 'Journalist' | 'Bot';

export type ArticleStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'published'
  | 'scheduled'
  | 'unpublished'
  | 'archived';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  bio?: string;
  photo?: string;
  active: number;
  created_at: string;
}

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  category: string;
  area?: string;
  hero_image?: string;
  image_caption?: string;
  photo_credit?: string;
  photo_source?: string;
  author_id: string;
  status: ArticleStatus;
  is_breaking: number;
  is_featured: number;
  tags?: string;
  seo_title?: string;
  meta_description?: string;
  source_type?: string;
  source_url?: string;
  source_name?: string;
  verified?: number;
  legal_check?: string;
  legal_checked?: number;
  embargo_until?: string;
  correction_note?: string;
  last_updated_by?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_role?: string;
  author_photo?: string;
  category_name?: string;
}

export interface ArticleRevision {
  id: string;
  article_id: string;
  editor_email: string;
  previous_title: string;
  previous_body: string;
  change_summary?: string;
  created_at: string;
}

export interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}
