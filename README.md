# The Daily Scot 🏴󠁧󠁢󠁳󠁣󠁴󠁿

[![Build check](https://github.com/abbassherhere-glitch/the-daily-scot1/actions/workflows/ci.yml/badge.svg)](https://github.com/abbassherhere-glitch/the-daily-scot1/actions/workflows/ci.yml)

### Independent Glasgow & Scotland Regional News Outlet

*The Daily Scot* is a fast, robust regional broadsheet newspaper application engineered for production deployment on **Cloudflare Pages (Free Tier)**. It separates the **public-facing news site** from the **internal newsroom editorial CMS** across two distinct Cloudflare Pages projects sharing a single **Cloudflare D1** SQLite database and **Cloudflare R2** media storage bucket, secured by **Cloudflare Zero Trust (Access)**.

---

## Production Multi-Project Architecture

```
                                  +-------------------------------------------------+
                                  |            Cloudflare Global Edge Network       |
                                  |         (SSL/TLS, CDN Caching, DDoS, WAF)       |
                                  +------------------------+------------------------+
                                                           |
                         +---------------------------------+---------------------------------+
                         |                                                                   |
          [ Public Project: thedailyscot.co.uk ]                             [ Newsroom CMS: admin.thedailyscot.co.uk ]
             React + Vite + Tailwind Frontend                                Protected by Cloudflare Zero Trust (Access)
             Zero admin code in client bundle                                Independent React + Vite Admin Bundle
             Read-only cached API (/functions/api/*)                         Full Editorial Newsroom (/admin-app/functions/api/admin/*)
             XML Sitemaps, Google News, RSS 2.0                              Cryptographic JWT verification (iss, aud, certs)
                         |                                                                   |
                         +---------------------------------+---------------------------------+
                                                           |
                                            +--------------+--------------+
                                            |                             |
                                   [ Cloudflare D1 ]              [ Cloudflare R2 ]
                                    Database ("DB")                Media ("MEDIA")
                                 daily-scot-db                  daily-scot-media
                              Articles, Users, Audit, Subs    Photographs (Max 5MB)
```

---

## Automatic Build Check (GitHub Actions)

Every push to `main` and every pull request runs `.github/workflows/ci.yml`, which:

1. installs dependencies exactly as pinned in `bun.lock`;
2. type-checks all code (`npm run lint`);
3. builds the public site and the newsroom;
4. compiles both sets of Pages Functions and the scheduler Worker the same way Cloudflare does;
5. applies every file in `migrations/` (plus the demo seed) to a test database to make sure they still work.

If any step fails, the commit gets a red ✗ on GitHub and you are emailed. Open the **Actions** tab to see which step failed. You can also run it by hand from **Actions → Build check → Run workflow**.

**Recommended:** make changes on a separate branch and open a pull request, and protect `main` on GitHub (**Settings → Branches → Add rule → Require status checks to pass → "Type-check, build and validate"**), so code that fails the check can't be merged. Cloudflare Pages deploys whatever lands on `main`, so this is what stops a broken build from going live.

---

## Step-by-Step Production Deployment Guide (Free Tier)

Both the public reader site and newsroom CMS run within Cloudflare's generous free tier limits (D1: 5M reads/month, R2: 10GB storage, Pages: unlimited requests).

---

### Step 1: Push Code to GitHub

1. Create a repository on GitHub (e.g. `the-daily-scot`).
2. Push your codebase:
   ```bash
   git init
   git add .
   git commit -m "feat: The Daily Scot production split architecture"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USER/the-daily-scot.git
   git push -u origin main
   ```

---

### Step 2: Provision Shared D1 Database & R2 Storage

1. Open your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. **Create the D1 Database**:
   - Go to **Storage & Databases** → **D1** → **Create database**.
   - Name: `daily-scot-db`.
   - Copy the generated **Database ID** (UUID).
3. **Put the Database ID into all three config files** (replace `REPLACE_WITH_D1_ID`) and commit:
   - `wrangler.toml` (public site)
   - `admin-app/wrangler.toml` (newsroom)
   - `scheduler/wrangler.toml` (scheduler)

   > Because these projects have a `wrangler.toml`, Cloudflare Pages reads bindings and variables **from the file**, not from the dashboard. A placeholder ID will make deployments fail.
4. **Create the R2 Media Storage Bucket**:
   - Go to **R2** → **Create bucket**.
   - Name: `daily-scot-media`.
   - In bucket **Settings** → **Public access**, connect your custom media domain (e.g. `https://media.thedailyscot.co.uk`) or enable the `*.r2.dev` URL.
5. **Run the migrations** (all are required, in order; none inserts demo content):
   ```bash
   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0001_init.sql
   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0002_production_setup.sql
   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0003_bylines.sql
   npx wrangler d1 execute daily-scot-db --remote --file=./migrations/0004_clean_tags.sql
   ```
   `0002` adds the section categories, the wire-ingest Bot user, newsletter unsubscribe tokens and revision proposals.
   `0003` adds story bylines (the public credit line and `/author/<name>` pages). Run it once; a second run stops with a harmless "duplicate column" error.
   `0004` repairs article tags that older versions of the newsroom editor had nested into garbled text (e.g. `["[\"Glasgow\"",…`). It is safe to run more than once.

   > `seed.demo.sql` contains **fictional demo stories for local testing only**. Never run it with `--remote`.

---

### Step 3: Deploy Project 1 — Public Website (`thedailyscot.co.uk`)

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**.
2. Select your repository.
3. Configure Public Build settings:
   - **Project Name**: `daily-scot-public`
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave blank)
4. **Build variables** (Settings → Variables and Secrets, type *Plaintext*):
   - `VITE_TURNSTILE_SITE_KEY` – your Cloudflare Turnstile **site** key (enables spam protection on the newsletter form).
   - `SITE_URL` – optional. The one address Google should list for the site (default `https://thedailyscot.co.uk`). Canonical links, sitemaps and the RSS feed all use it, so the `*.pages.dev` address never competes with your real domain.
5. **Runtime secrets**:
   ```bash
   npx wrangler pages secret put TURNSTILE_SECRET --project-name daily-scot-public
   npx wrangler pages secret put RESEND_API_KEY   --project-name daily-scot-public
   ```
   Set the Turnstile site key and secret **together** – one without the other blocks or disables the check.
6. Click **Save and Deploy**, then connect your domain (e.g. `thedailyscot.co.uk`) under **Custom domains**.

---

### Step 4: Configure Cloudflare Zero Trust (Access) for Newsroom

Before deploying the newsroom app, protect the admin subdomain:

1. In Cloudflare, navigate to **Zero Trust** ([one.dash.cloudflare.com](https://one.dash.cloudflare.com)).
2. Go to **Settings** → **Custom Pages** and note your **Team domain** (`<team>.cloudflareaccess.com` – you need just `<team>`).
3. Go to **Access** → **Applications** → **Add an application** → **Self-hosted**:
   - **Application name**: `The Daily Scot Newsroom`
   - **Application domains**: `admin.thedailyscot.co.uk` **and** `daily-scot-admin.pages.dev` **and** `*.daily-scot-admin.pages.dev` (preview deployments) – otherwise the `pages.dev` URLs bypass Access.
   - **Session Duration**: `24 hours`
4. Define Policy:
   - **Policy name**: `Editorial Staff Only`
   - **Action**: `Allow`
   - **Rules**: Include **Emails** (named staff), and require MFA.
5. For the wire bot, create a **Service Token** (Access → Service Auth) and add a second policy with **Action: Service Auth** including that token.
6. Save the application and copy its **Application Audience (AUD) Tag**.

---

### Step 5: Deploy Project 2 — Newsroom CMS (`admin.thedailyscot.co.uk`)

Cloudflare Pages only runs Functions from a `functions/` folder at the project's **root directory**, so the newsroom project uses `admin-app` as its root.

1. Edit `admin-app/wrangler.toml` and set:
   - `CF_ACCESS_TEAM_DOMAIN` = your team name from Step 4 (e.g. `dailyscot`)
   - `CF_ACCESS_AUD` = the AUD tag from Step 4
   - `MEDIA_PUBLIC_URL` = your R2 public URL

   Until these are real values the newsroom refuses every login (HTTP 503) – this is deliberate.
2. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** and select the same repository.
3. Configure Admin Build settings:
   - **Project Name**: `daily-scot-admin`
   - **Framework preset**: `None`
   - **Root directory**: `admin-app`
   - **Build command**: `cd .. && npm install && npm run build:admin`
   - **Build output directory**: `dist`
4. **Secrets** (for the wire-ingest bot):
   ```bash
   npx wrangler pages secret put BOT_CLIENT_ID --project-name daily-scot-admin   # the service token's Client ID
   ```
5. Click **Save and Deploy**, then connect `admin.thedailyscot.co.uk` under **Custom domains**.

---

### Step 6: Add Your Email as Newsroom Owner

In Cloudflare D1 Console, grant your Zero Trust email Owner permissions:

```sql
INSERT INTO users (id, email, name, role, bio, active)
VALUES (
  'usr-owner-main',
  'YOUR_ACTUAL_EMAIL@domain.com',
  'Your Name',
  'Owner',
  'Editor-in-Chief',
  1
)
ON CONFLICT(email) DO UPDATE SET role = 'Owner', active = 1;
```

Now, navigating to `https://admin.thedailyscot.co.uk` prompts Cloudflare Zero Trust authentication. Once verified, the server verifies the cryptographic JWT assertion and loads your Owner newsroom dashboard.

---

## Newsroom Roles & Permissions Matrix

All access rules are enforced strictly server-side by `/admin-app/functions/api/admin/_middleware.ts`:

| Permission | Owner | Editor | Journalist | Bot | Public |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Read Published Articles | ✅ | ✅ | ✅ | ❌ | ✅ |
| Subscribe to Morning Briefing | ✅ | ✅ | ✅ | ❌ | ✅ |
| Access Newsroom CMS (`admin.*`) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Drafts & Submit for Review | ✅ | ✅ | ✅ | ❌ | ❌ |
| Automated Feed Ingest (`/api/admin/ingest`) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit Own Articles | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Any Colleague's Story | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish Stories Directly | ✅ | ✅ | ❌ | ❌ | ❌ |
| Unpublish / Retract Stories | ✅ | ✅ | ❌ | ❌ | ❌ |
| Restore Past Revisions / Apply Proposed Changes | ✅ | ✅ | ❌ | ❌ | ❌ |
| Propose Changes to a Live Story (held for review) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Schedule Stories | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set "Breaking News" Strip | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set "Front-Page Lead" | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Articles | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload Photographs to Cloudflare R2 | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Newsroom Security Audit Log | ✅ | ✅ | ❌ | ❌ | ❌ |
| View & Export Newsletter Subscribers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Newsroom Staff & Roles | ✅ | ❌ | ❌ | ❌ | ❌ |

---

### Step 7: Automated Scheduler Worker (`/scheduler`)

A separate Cloudflare Worker handles cron-triggered publishing of scheduled stories:

1. Deploy the worker from `/scheduler`:
   ```bash
   cd scheduler
   npx wrangler deploy
   ```
2. Every 5 minutes the worker:
   - publishes stories whose status is `scheduled` and whose **Publish At** time has passed – re-checking the legal, embargo and verification rules first. A story that fails a rule is moved back to `needs_review` and the reason is written to the audit log;
   - clears the Breaking flag from stories whose breaking window has ended;
   - deletes expired newsletter rate-limit rows.

   Editors schedule a story by setting **Publish At** in the editor and clicking **Schedule**. Times are entered in local time and stored in UTC.

---

### Step 8: Wire Feed Ingestion with Cloudflare Access Service Token

Automated feeds and wire bots ingest drafts directly into the `needs_review` queue without human interaction:

- **Endpoint**: `POST /api/admin/ingest`
- **Headers**:
  - `CF-Access-Client-Id`: `<Your Cloudflare Access Service Token Client ID>`
  - `CF-Access-Client-Secret`: `<Your Cloudflare Access Service Token Secret>`
- **Payload Constraints**:
  - Automatically assigned `status: 'needs_review'`. Bots cannot publish, approve, or delete stories.
  - `hero_image` may be an `https://` URL or a base64 `data:image/...` URL (JPEG/PNG/WebP, max 5MB) – data URLs are stored in R2 automatically.
  - Duplicate headlines get a unique slug automatically.
  - Stories require editorial approval and legal check clearance before going live on the public site.

---

## Search Engines & Google (SEO)

The public site is a React app, so most of it only exists once JavaScript runs. To make sure Google, Bing, Google News and social-media previews can read it, the Pages Functions in `functions/` hand each address its own search tags **and real content** before the app loads (React then replaces it, so readers see no difference):

| Address | What search engines get |
|---|---|
| `/` | Title, description, canonical link, publisher + site structured data, latest 30 headlines as links |
| `/news/<section>` | The section's own title/description (`src/config/seoText.ts`), canonical link, `CollectionPage` data, the section's latest 50 stories |
| `/news/<story>` | The newsroom's **SEO title** and **meta description** (falling back to headline / standfirst), canonical link, `NewsArticle` + breadcrumb data, full story text, byline, hero image with alt text, "more from this section" links |
| `/author/<slug>` | Name, bio, `ProfilePage` data, the author's stories with pagination links |
| `/about`, `/privacy`, … | See "Company details" below |
| anything else | A real **404** with `noindex` (previously the homepage was returned with a 200) |

Other things that are handled for you:

- **One address per page.** Canonical links use `SITE_URL`, not the address the visitor arrived on. `/news` redirects to `/`, `/news/<section>/<story>` and upper-case slugs 301 to the real address, and `/?utm_source=…` is the same page as `/`.
- **Cloudflare's own addresses are kept out of Google.** Anything served on `*.pages.dev` / `*.workers.dev` is sent `noindex`. Raw API responses (`/api/*`) are `noindex` too, and `/search` is not indexed.
- **Feeds.** `/sitemap.xml` (sections, authors, up to 5,000 stories with images and true last-modified dates), `/news-sitemap.xml` (stories from the last 48 hours, for Google News) and `/rss.xml` are all advertised in `robots.txt` / the page head.
- **Pages never go stale.** Generated pages are not given the static file's ETag, so a crawler that re-checks a page always receives the current version.

### Company details

The footer's About, Contact, Advertise, Complaints, Privacy, Cookie and Terms text also has a page of its own (`/about`, `/contact`, `/advertise`, `/complaints`, `/privacy`, `/cookies`, `/terms`); a normal click on a footer link still opens the same pop-up. Google News and quality reviewers expect these pages.

The details shown on them come from `src/config/site.ts`. Anything left empty (`''`) is simply not shown: the line or sentence that would use it is left out.

- **Emails** (`contactEmail`, `newsdeskEmail`, `complaintsEmail`, `advertisingEmail`) are empty for now because no mailboxes exist yet. A page that depends on one stays out of Google, and out of the sitemap, until it is filled in: **Contact** (needs any of the two emails or the phone), **Advertise** (`advertisingEmail`), **Complaints** (`complaintsEmail`) and **Privacy** (`contactEmail`, so people can reach you about their data). They show "being set up" wording meanwhile. **About, Cookies and Terms** do not depend on an email and are indexable already.
- To create the mailboxes for free: Cloudflare dashboard → your domain → **Email** → **Email Routing**, add each address and forward it to an inbox you already use, then put the address in `site.ts`.
- `companyNumber` and `phone` are empty too. Fill them in when you have them; do not invent a registration number or phone number, as the site states them publicly.
- Anything wrapped in `[square brackets]` is treated as an unfinished placeholder: while one remains, all seven pages are served `noindex`.

### After deploying

1. Open **Google Search Console** → add `https://thedailyscot.co.uk` as a property, then **Sitemaps** → submit `sitemap.xml` and `news-sitemap.xml`. Do the same in **Bing Webmaster Tools**.
2. In Search Console, **URL Inspection** → test the live URL of the homepage and a story: "View crawled page" should show the headlines / story text.
3. Add the site's official social profiles (Facebook, X, Instagram, LinkedIn…) to `SAME_AS` in `functions/utils/seo.ts` once the accounts exist; Google uses them to recognise the publisher.
4. Test a story with Google's **Rich Results Test**.
5. Optionally, in Cloudflare, redirect `daily-scot-public.pages.dev` to your domain and make sure `www.` redirects to the bare domain, so there is only ever one address.

Section titles and descriptions live in `src/config/seoText.ts`; edit them there. Per-story titles and descriptions come from the SEO fields in the newsroom editor.

---

## Security Audit Hardening Highlights

- **Fail-Closed Configuration**: If `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` are missing or still placeholders, every newsroom request is refused.
- **Cryptographic JWT Verification**: Every admin request cryptographically checks the `Cf-Access-Jwt-Assertion` against Cloudflare team public certs (`/cdn-cgi/access/certs`), verifying the RS256 signature (always – tokens without a key ID are rejected), `exp`, `nbf`, audience `aud`, and issuer `iss`. The `Cf-Access-Authenticated-User-Email` header is never trusted.
- **No Production Dev Bypass**: The development header bypass is disabled in all production builds and only operates if `env.ENVIRONMENT === 'local'` on `localhost`/`127.0.0.1`.
- **HTMLRewriter Allow-list Sanitization**: Story HTML is processed using Cloudflare's native streaming `HTMLRewriter`. Only safe tags are allowed (`p, h2, h3, strong, em, a[href], ul, ol, li, blockquote, figure, figcaption, img[src,alt]`). All dangerous scripts, iframes, and inline event handlers (`onload`, `onclick`) are eliminated.
- **Full Audit Logging**: Every newsroom action (create, edit, publish, unpublish, delete, user change, image upload) records an immutable entry into D1 `audit_log` with user ID, email, action type, article ID, before/after status transition, timestamp, and client IP (`cf-connecting-ip`).
- **Journalist Edits to Live Stories Are Held for Review**: they are saved as a *proposed change* in revision history; the live article is untouched until an Editor clicks **Apply changes**.
- **Newsletter Compliance**: double opt-in, Turnstile spam protection, and a per-subscriber unsubscribe link (`/api/unsubscribe`, also sent as a `List-Unsubscribe` header). Include `/api/unsubscribe?email=…&token=…` in every newsletter you send.
- **Complete Client Bundle Separation**: The public site bundle contains zero admin components, no admin routes, no newsroom links, and no role switchers.
- **Fail-Safe Reliability**: In production, if an API call fails, the application presents a proper error state rather than falling back to fake or mock stories. The admin CMS never pretends to save unpublished articles into browser local storage.

---

## Cloudflare Security Checklist

Before launching to live production, complete this essential security checklist in your Cloudflare dashboard:

1. **Cloudflare Zero Trust (Access) Application**:
   - Create an Access Self-Hosted Application protecting `admin.thedailyscot.co.uk`.
   - **CRITICAL**: Add additional application rules protecting the admin `*.pages.dev` and preview deployment URLs so that direct `.pages.dev` URLs cannot bypass Access.
   - Configure Access Policy with action **Allow**:
     - Restricted exclusively to named staff emails (or corporate Google Workspace / Okta IdP).
     - Require Multi-Factor Authentication (MFA / 2FA).
2. **TLS / SSL & Domain Protection**:
   - **Encryption Mode**: SSL/TLS set to **Full (strict)**.
   - **Always Use HTTPS**: Enabled.
   - **HSTS (HTTP Strict Transport Security)**: Enabled with `max-age=31536000; includeSubDomains; preload`.
   - **DNSSEC**: Enabled on the registrar/DNS zone to prevent DNS spoofing.
3. **Web Application Firewall (WAF) & Rate Limiting**:
   - Enable **Cloudflare Managed Ruleset** (OWASP Core Ruleset).
   - Create a **Rate Limiting Rule** targeting `/api/*` (e.g. max 60 requests per minute per IP for public endpoints, max 5 per 10 minutes for newsletter signup).
   - Enable **Bot Fight Mode** to block malicious scrapers and credential stuffing.
4. **Cloudflare Account Security**:
   - Enforce mandatory **2FA (FIDO2 / TOTP)** across all administrative Cloudflare account users.
   - Restrict API tokens to minimal required scopes (e.g. D1 edit, Pages edit).
5. **Database Production Hygiene**:
   - **NEVER run `seed.demo.sql` on production!** That file is strictly for local sandbox fixtures.
   - Apply only the files in `migrations/` (0001, 0002, 0003, then 0004) to your production D1 instance.
   - Store all credentials (`BOT_CLIENT_ID`, `TURNSTILE_SECRET`, `RESEND_API_KEY`) via `wrangler pages secret put` — never commit secrets to source control or plaintext `[vars]`.

