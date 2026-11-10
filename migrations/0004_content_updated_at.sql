-- Migration 0004: when a story's words last changed
--   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0004_content_updated_at.sql
--
-- articles.updated_at changes on every save, including a byline change or a "breaking" label expiring,
-- so it cannot be shown to readers as "Updated". The new column is set only when the headline,
-- standfirst or body of a story changes.
--
--   content_updated_at  UTC 'YYYY-MM-DD HH:MM:SS'; NULL until a story's words are edited
--
-- Existing stories keep NULL and are treated as unchanged since they were published.
-- Run this once. (SQLite cannot re-add a column, so a second run fails harmlessly with "duplicate column".)

ALTER TABLE articles ADD COLUMN content_updated_at TEXT;

-- "Happening now" on the homepage looks up the most recently changed live stories
CREATE INDEX IF NOT EXISTS idx_articles_content_updated ON articles(status, content_updated_at DESC);
