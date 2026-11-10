-- Migration 0005: road closures and roadworks
--   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0005_road_closures.sql
--
-- One row per closure shown on /glasgow-road-closures, on the homepage panel and in the "Live travel" line.
--
--   kind               what is affected: road, motorway, bus, subway or rail (drives the page's filter buttons)
--   status             closed | overnight | extended | planned | reopened
--   starts_at/ends_at  UTC 'YYYY-MM-DD HH:MM:SS'; ends_at may be NULL when no end date has been given
--   latitude/longitude where the numbered pin goes on the map
--   closure_geojson    optional GeoJSON LineString for the closed stretch
--   diversion_geojson  optional GeoJSON LineString for the diversion route
--   article_id         optional story about this closure
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS road_closures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT,
  kind TEXT NOT NULL DEFAULT 'road' CHECK (kind IN ('road', 'motorway', 'bus', 'subway', 'rail')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('closed', 'overnight', 'extended', 'planned', 'reopened')),
  starts_at TEXT,
  ends_at TEXT,
  reason TEXT,
  diversion TEXT,
  latitude REAL,
  longitude REAL,
  closure_geojson TEXT,
  diversion_geojson TEXT,
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  created_by TEXT,
  last_updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_road_closures_status ON road_closures(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_road_closures_article ON road_closures(article_id);
