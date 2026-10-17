-- Migration 0003: story bylines (who a story is credited to on the public site)
--   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0003_bylines.sql
--
-- articles.author_id is NOT changed: it still records the staff account that really created the story.
-- The new columns only control the public credit line.
--
--   byline          display name, e.g. 'The Daily Scot Staff', 'Syed Hassan' or a guest's name
--   byline_slug     URL-friendly form used for /author/<slug> pages, e.g. 'syed-hassan'
--   byline_user_id  the staff member credited (NULL for the staff desk or a guest contributor)
--
-- Existing stories keep NULL in all three columns; the site shows them as 'The Daily Scot Staff'.
-- Run this once. (SQLite cannot re-add a column, so a second run fails harmlessly with "duplicate column".)

ALTER TABLE articles ADD COLUMN byline TEXT;
ALTER TABLE articles ADD COLUMN byline_slug TEXT;
ALTER TABLE articles ADD COLUMN byline_user_id TEXT REFERENCES users(id);

-- Author pages list a byline's published stories, newest first
CREATE INDEX IF NOT EXISTS idx_articles_byline ON articles(byline_slug, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_byline_user ON articles(byline_user_id);
