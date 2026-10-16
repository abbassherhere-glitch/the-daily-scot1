-- ============================================================================
-- WARNING: LOCAL DEVELOPMENT / DEMO DATA ONLY
-- NEVER RUN ON PRODUCTION!
-- Sample stories and mock figures in this file are strictly for local UI testing.
-- Real organisations and made-up figures must never reach production databases.
-- ============================================================================

-- Categories (Matches canonical sections in src/config/site.ts)
INSERT OR REPLACE INTO categories (slug, name, description, sort_order) VALUES
  ('news', 'News', 'Latest breaking news, crime, courts and council reports from Glasgow', 1),
  ('glasgow', 'Glasgow', 'Local community stories and neighbourhood news across Glasgow', 2),
  ('scotland', 'Scotland', 'Scottish national news, transport and politics', 3),
  ('politics', 'Politics', 'Glasgow City Chambers, Holyrood and Scottish council affairs', 4),
  ('business', 'Business', 'Local high street, commercial property, jobs and retail news', 5),
  ('property', 'Property', 'Glasgow house prices, tenement sales and new developments', 6),
  ('sport', 'Sport', 'Celtic, Rangers, Partick Thistle, Queen''s Park and Scottish sport', 7),
  ('whats-on', 'What''s On', 'Glasgow food, drink, restaurants, gigs, events and things to do', 8),
  ('opinion', 'Opinion', 'Comment, letters and analysis from The Daily Scot columnists', 9);

-- Users (Role-based: Owner, Editor, Journalist, Bot) - uses example.com only
INSERT OR REPLACE INTO users (id, email, name, role, bio, photo, active) VALUES
  ('usr-owner-1', 'editor@example.com', 'Callum MacIntyre', 'Owner', 'Editor-in-Chief', 'https://picsum.photos/seed/reporter1/150/150', 1),
  ('usr-editor-1', 'catriona@example.com', 'Catriona Fraser', 'Editor', 'Chief Reporter', 'https://picsum.photos/seed/reporter2/150/150', 1),
  ('usr-journo-1', 'craig@example.com', 'Craig Stewart', 'Journalist', 'Transport & Business Reporter', 'https://picsum.photos/seed/reporter3/150/150', 1),
  ('usr-journo-2', 'davie@example.com', 'Davie Murdoch', 'Journalist', 'Chief Football Writer', 'https://picsum.photos/seed/reporter4/150/150', 1),
  ('usr-journo-3', 'ailsa@example.com', 'Ailsa Crawford', 'Journalist', 'Courts & Council Reporter', 'https://picsum.photos/seed/reporter5/150/150', 1);

-- Demo Articles (Local mock fixtures only)
INSERT OR REPLACE INTO articles (
  id, slug, title, standfirst, body, category, area, hero_image, image_caption, photo_credit, photo_source, author_id,
  status, is_breaking, is_featured, tags, seo_title, meta_description, published_at
) VALUES
(
  'm8-slip-road-closure',
  'm8-slip-road-closure-kingston-bridge-three-weeks',
  'Roadworks to close M8 slip road near Kingston Bridge for three weeks',
  'Drivers face major morning rush hour diversions as multi-million pound resurfacing begins next Monday.',
  '<p>Motorists travelling through Glasgow face weeks of disruption as a key section of the M8 motorway is set to close for essential engineering works.</p><p>Transport authorities confirmed that the Junction 19 eastbound on-slip near Waterloo Street will be completely shut to all vehicular traffic starting at 6am on Monday.</p><p>The closure will remain in place for approximately three weeks while contractors carry out critical bridge joint repairs, structural waterproofing, and carriageway resurfacing.</p><p>Diversion routes will be heavily signposted directing vehicles via Pitt Street, St Vincent Street, and North Street to join the motorway at Junction 18 Charing Cross.</p>',
  'news',
  'Glasgow City Centre',
  'https://picsum.photos/seed/m8road/800/450',
  'Heavy traffic queuing on the M8 approach towards the Kingston Bridge.',
  'Staff Photographer',
  'The Daily Scot',
  'usr-journo-1',
  'published',
  1,
  0,
  '["M8","Kingston Bridge","Traffic","Glasgow Roads"]',
  'Roadworks to close M8 slip road near Kingston Bridge | The Daily Scot',
  'Drivers face major morning rush hour diversions as resurfacing begins next Monday.',
  '2026-10-15 11:45:00'
),
(
  'glasgow-bar-licence-row',
  'glasgow-bar-owner-hits-back-after-licence-row',
  'Glasgow bar owner hits back after licence row with licensing board',
  'The Merchant City venue faced objections from local residents over 2am outdoor seating noise complaints.',
  '<p>A popular Merchant City venue operator has hit back after his venue was called before city licensing officials following objections from neighbouring residents.</p><p>The licensing committee met at the City Chambers this morning to review complaints regarding outdoor music and patio use at the Bell Street establishment.</p><p>Four local residents submitted written objections claiming evening customers were causing excessive noise late into the night.</p><p>However, the management presented decibel monitoring logs showing zero statutory noise breaches over the past twelve months. The licence was successfully renewed with agreed conditions.</p>',
  'glasgow',
  'Glasgow City Centre',
  'https://picsum.photos/seed/glasgowbar/800/450',
  'The Merchant City bar has operated on Bell Street for more than eight years.',
  'Staff Photographer',
  'The Daily Scot',
  'usr-editor-1',
  'published',
  0,
  1,
  '["Merchant City","Licensing","City Chambers","Glasgow Bars"]',
  'Glasgow bar owner hits back after licence row | The Daily Scot',
  'Merchant City venue owner defends licensing record before City Chambers committee.',
  '2026-10-15 11:15:00'
),
(
  'celtic-injury-boost-derby',
  'celtic-injury-boost-midfielder-returns-ahead-of-derby',
  'Celtic injury boost as star midfielder returns to full training ahead of derby',
  'Manager confirms key playmaker is available after three weeks on the sidelines with hamstring strain.',
  '<p>Celtic have received a major fitness boost ahead of Sunday''s showdown with the confirmation that their influential midfield playmaker completed full squad training at Lennoxtown this morning.</p><p>The 25-year-old international had been sidelined since limping off prior to the international break.</p><p>The manager addressed reporters at his pre-match press conference: "He looked sharp today, full of energy and ready to compete."</p>',
  'sport',
  'Glasgow',
  'https://picsum.photos/seed/celticmatch/800/450',
  'Celtic Park will host the sold-out Glasgow derby this weekend.',
  'SNS Group',
  'SNS Group',
  'usr-journo-2',
  'published',
  0,
  0,
  '["Celtic","SPFL","Football","Scottish Premiership"]',
  'Celtic injury boost ahead of derby | The Daily Scot',
  'Star midfielder returns to full training ahead of the Glasgow derby.',
  '2026-10-15 10:30:00'
),
(
  'rangers-boss-transfer-speculation',
  'rangers-boss-responds-to-transfer-speculation-defender',
  'Rangers boss responds to transfer speculation over key defender',
  'Ibrox manager delivers firm verdict following reports of European interest in centre-back.',
  '<p>Rangers management has dismissed reports linking the star defender with a January switch to the German Bundesliga, insisting the player is fully committed to Ibrox.</p><p>"There has been no contact from any club, and nor would we welcome any," said the manager. "He signed a four-year contract extension in the summer because he believes in what we are building here. His focus is entirely on Sunday''s derby."</p>',
  'sport',
  'Glasgow',
  'https://picsum.photos/seed/rangersfc/800/450',
  'The Rangers manager addressed media at the club''s training centre.',
  'SNS Group',
  'SNS Group',
  'usr-journo-2',
  'published',
  0,
  0,
  '["Rangers","Ibrox","SPFL","Football"]',
  'Rangers boss responds to transfer speculation | The Daily Scot',
  'Ibrox boss delivers clear message on defender transfer rumours.',
  '2026-10-15 10:00:00'
);

-- Initial Audit Log (example.com email)
INSERT OR REPLACE INTO audit_log (id, user_id, user_email, action, details, created_at) VALUES
  ('aud-init-1', 'usr-owner-1', 'editor@example.com', 'SYSTEM_INITIALIZE', 'Database initialized with demo data.', datetime('now'));

-- Initial Newsletter Subscriber (example.com domain)
INSERT OR REPLACE INTO newsletter_subscribers (email, confirmed, created_at) VALUES
  ('subscriber@example.com', 1, datetime('now'));
