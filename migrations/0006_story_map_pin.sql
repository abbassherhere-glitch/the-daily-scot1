-- Migration 0006: an optional map pin on any story (incidents, events, openings)
--   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0006_story_map_pin.sql
--
--   map_latitude / map_longitude  where the pin goes; NULL when the story has no map
--   map_label                     short caption for the pin, e.g. 'Sauchiehall Street, near Rose Street'
--
-- Existing stories keep NULL and show no map.
-- Run this once. (SQLite cannot re-add a column, so a second run fails harmlessly with "duplicate column".)

ALTER TABLE articles ADD COLUMN map_latitude REAL;
ALTER TABLE articles ADD COLUMN map_longitude REAL;
ALTER TABLE articles ADD COLUMN map_label TEXT;
