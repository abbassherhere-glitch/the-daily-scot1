-- Migration 0002: production reference data, newsletter unsubscribe, revision proposals, date normalisation
-- Safe to run on production and safe to run more than once.
--   npx wrangler d1 execute daily-scot-db --file=./migrations/0002_production_setup.sql --remote

-- 1. Categories (articles.category references this table, so it must be populated before any story is saved)
INSERT OR IGNORE INTO categories (slug, name, description, sort_order) VALUES
  ('news', 'News', 'Latest breaking news, crime, courts and council reports from Glasgow', 1),
  ('glasgow', 'Glasgow', 'Local community stories and neighbourhood news across Glasgow', 2),
  ('scotland', 'Scotland', 'Scottish national news, transport and politics', 3),
  ('politics', 'Politics', 'Glasgow City Chambers, Holyrood and Scottish council affairs', 4),
  ('business', 'Business', 'Local high street, commercial property, jobs and retail news', 5),
  ('property', 'Property', 'Glasgow house prices, tenement sales and new developments', 6),
  ('sport', 'Sport', 'Scottish football and sport', 7),
  ('whats-on', 'What''s On', 'Glasgow food, drink, gigs, events and things to do', 8),
  ('opinion', 'Opinion', 'Comment, letters and analysis from The Daily Scot columnists', 9);

-- 2. System Bot user for automated wire ingest (articles.author_id must reference a real user)
INSERT OR IGNORE INTO users (id, email, name, role, bio, active)
VALUES ('usr-bot-service', 'ingest-bot@dailyscot.co.uk', 'Wire Ingest Bot', 'Bot', 'Automated feed ingest (drafts only)', 1);

-- 3. Newsletter: permanent per-subscriber unsubscribe token (UK PECR / GDPR)
ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT;
UPDATE newsletter_subscribers SET unsubscribe_token = lower(hex(randomblob(16))) WHERE unsubscribe_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsub ON newsletter_subscribers(unsubscribe_token);

-- 4. Revisions: distinguish snapshots of old versions from journalists' proposed changes
--    kind = 'snapshot' (previous version), 'proposal' (awaiting editor), 'applied' (proposal accepted)
ALTER TABLE article_revisions ADD COLUMN kind TEXT NOT NULL DEFAULT 'snapshot';
CREATE INDEX IF NOT EXISTS idx_revisions_kind ON article_revisions(article_id, kind);

-- 5. Normalise any ISO-8601 timestamps ('2026-10-16T08:00:00.000Z') to SQLite UTC format
--    ('2026-10-16 08:00:00') so ordering and comparisons with datetime('now') are correct.
UPDATE articles SET published_at = datetime(published_at) WHERE published_at LIKE '%T%';
UPDATE articles SET breaking_until = datetime(breaking_until) WHERE breaking_until LIKE '%T%';
UPDATE articles SET embargo_until = datetime(embargo_until) WHERE embargo_until LIKE '%T%';
UPDATE articles SET published_at = NULL WHERE published_at = '';
UPDATE articles SET embargo_until = NULL WHERE embargo_until = '';

-- 6. Indexes used by the public site
CREATE INDEX IF NOT EXISTS idx_articles_breaking ON articles(is_breaking, status);
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(is_featured, status);
