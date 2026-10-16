-- Migration 0001: The Daily Scot Complete Production Schema for Cloudflare D1 (SQLite)

-- 1. Users Table (Role-based access: Owner, Editor, Journalist, Bot)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('Owner', 'Editor', 'Journalist', 'Bot')) NOT NULL,
  bio TEXT,
  photo TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 3. Articles Table (Includes full newsroom editorial & legal review workflow)
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  standfirst TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(slug),
  area TEXT,
  hero_image TEXT,
  image_caption TEXT,
  photo_credit TEXT,
  photo_source TEXT,
  author_id TEXT NOT NULL REFERENCES users(id),
  status TEXT CHECK(status IN ('draft', 'needs_review', 'approved', 'published', 'scheduled', 'unpublished', 'archived')) NOT NULL DEFAULT 'draft',
  is_breaking INTEGER NOT NULL DEFAULT 0,
  breaking_until TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  seo_title TEXT,
  meta_description TEXT,
  -- Workflow & Legal checks
  source_type TEXT CHECK(source_type IN ('Police Scotland', 'Council', 'Press release', 'Court', 'Own reporting', 'Other outlet - follow-up')) DEFAULT 'Own reporting',
  source_url TEXT,
  source_name TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  legal_check TEXT CHECK(legal_check IN ('none', 'contempt risk - active court case', 'defamation risk', 'anonymity required')) DEFAULT 'none',
  legal_checked INTEGER NOT NULL DEFAULT 0,
  embargo_until TEXT,
  correction_note TEXT,
  last_updated_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Article Revisions Table (Track changes & rollbacks)
CREATE TABLE IF NOT EXISTS article_revisions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  editor_email TEXT NOT NULL,
  previous_title TEXT NOT NULL,
  previous_body TEXT NOT NULL,
  change_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Page Views Table (Aggregated daily traffic tracking)
CREATE TABLE IF NOT EXISTS page_views (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, day)
);

-- 6. Audit Log Table (Tracking all admin actions with IP & status transition)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  article_id TEXT,
  before_status TEXT,
  after_status TEXT,
  ip TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Newsletter Subscribers Table (Double opt-in verification)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email TEXT PRIMARY KEY,
  confirmed INTEGER NOT NULL DEFAULT 0,
  token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Rate Limits Table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category, status);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
