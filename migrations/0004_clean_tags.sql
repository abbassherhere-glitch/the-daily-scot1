-- Migration 0004: repair garbled article tags.
--
-- Older versions of the newsroom editor loaded a story's stored tags (a JSON array such as '["Glasgow","Scotland"]')
-- into the tags box as raw text and split it on commas when saving, so the brackets and quotes were nested into the
-- tags again on every edit, e.g. ["[\"Glasgow\"","\"Scotland\"","\"News\"]"].
--
-- This rewrites those rows as a clean JSON array of tag names. It is safe to run more than once: only rows that still
-- contain a backslash or a second '[' are touched, and a repaired row no longer matches.
--   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0004_clean_tags.sql

UPDATE articles
SET tags = CASE
  WHEN TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(tags, ', ', ','), '\', ''), '"', ''), '[', ''), ']', '')) = '' THEN '[]'
  ELSE '["' || REPLACE(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(tags, ', ', ','), '\', ''), '"', ''), '[', ''), ']', '')), ',', '","') || '"]'
END
WHERE tags LIKE '%\%' OR tags LIKE '[%[%';
