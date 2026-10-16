# The Daily Scot 🏴󠁧󠁢󠁳󠁣󠁴󠁿
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
          [ Public Project: dailyscot.co.uk ]                             [ Newsroom CMS: admin.dailyscot.co.uk ]
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
3. **Create the R2 Media Storage Bucket**:
   - Go to **R2** → **Create bucket**.
   - Name: `daily-scot-media`.
   - In bucket **Settings** → **Public access**, enable public access or connect your custom media domain (e.g. `https://media.dailyscot.co.uk` or the free `*.r2.dev` URL).
4. **Run Migrations & Seed Sample Stories**:
   In your terminal with Wrangler (or in Cloudflare D1 Web Console):
   ```bash
   # Apply schema (articles, users, audit_log, newsletter_subscribers)
   npx wrangler d1 execute daily-scot-db --file=./migrations/0001_init.sql --remote

   # Seed sample Glasgow stories and staff
   npx wrangler d1 execute daily-scot-db --file=./seed.sql --remote
   ```

---

### Step 3: Deploy Project 1 — Public Website (`dailyscot.co.uk`)

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**.
2. Select your `the-daily-scot` repository.
3. Configure Public Build settings:
   - **Project Name**: `daily-scot-public`
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
4. Click **Save and Deploy**.
5. Bind Shared Resources:
   - In `daily-scot-public` → **Settings** → **Functions**:
     - **D1 database bindings**: Variable `DB` → Select `daily-scot-db`.
     - **R2 bucket bindings**: Variable `MEDIA` → Select `daily-scot-media`.
   - In **Settings** → **Environment variables**:
     - `MEDIA_PUBLIC_URL`: `https://media.dailyscot.co.uk` (or your R2 public URL).
6. Connect your primary public domain (e.g. `dailyscot.co.uk`) under **Custom domains**.

---

### Step 4: Configure Cloudflare Zero Trust (Access) for Newsroom

Before deploying the newsroom app, protect the admin subdomain:

1. In Cloudflare, navigate to **Zero Trust** ([one.dash.cloudflare.com](https://one.dash.cloudflare.com)).
2. Go to **Settings** → **Custom Pages / General** and note your **Team domain** (e.g. `my-team`).
3. Go to **Access** → **Applications** → **Add an application** → **Self-hosted**:
   - **Application name**: `The Daily Scot Newsroom`
   - **Application domain**: `admin.dailyscot.co.uk` (Path: `/*`)
   - **Session Duration**: `24 hours`
4. Define Policy:
   - **Policy name**: `Editorial Staff Only`
   - **Action**: `Allow`
   - **Rules**: Include **Emails** or **Emails ending in** (e.g. `@dailyscot.co.uk` or your specific email).
5. Save the application and copy its **Audience (AUD) tag** (a 64-character hash).

---

### Step 5: Deploy Project 2 — Newsroom CMS (`admin.dailyscot.co.uk`)

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select the same `the-daily-scot` repository.
3. Configure Admin Build settings:
   - **Project Name**: `daily-scot-admin`
   - **Framework preset**: `None` (or `Vite`)
   - **Build command**: `npm run build:admin`
   - **Build output directory**: `admin-app/dist`
   - **Root directory**: `/`
4. Click **Save and Deploy**.
5. Bind Shared Resources & Access Credentials:
   - In `daily-scot-admin` → **Settings** → **Functions**:
     - **D1 database bindings**: Variable `DB` → Select `daily-scot-db`.
     - **R2 bucket bindings**: Variable `MEDIA` → Select `daily-scot-media`.
     - **Functions directory**: `admin-app/functions`
   - In **Settings** → **Environment variables**:
     - `CF_ACCESS_TEAM_DOMAIN`: Your Cloudflare Zero Trust team domain (e.g. `my-team`).
     - `CF_ACCESS_AUD`: Your audience tag from Step 4.
     - `MEDIA_PUBLIC_URL`: Your R2 media domain URL.
6. Connect `admin.dailyscot.co.uk` under **Custom domains**.

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

Now, navigating to `https://admin.dailyscot.co.uk` prompts Cloudflare Zero Trust authentication. Once verified, the server verifies the cryptographic JWT assertion and loads your Owner newsroom dashboard.

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
| Restore Past Revisions | ✅ | ✅ | ❌ | ❌ | ❌ |
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
2. The cron trigger `*/5 * * * *` automatically evaluates every 5 minutes:
   ```sql
   SELECT id, title, published_at FROM articles WHERE status = 'scheduled' AND published_at <= datetime('now');
   ```
   Due stories are updated to `status = 'published'` and an immutable audit trail entry is logged.

---

### Step 8: Wire Feed Ingestion with Cloudflare Access Service Token

Automated feeds and wire bots ingest drafts directly into the `needs_review` queue without human interaction:

- **Endpoint**: `POST /api/admin/ingest`
- **Headers**:
  - `CF-Access-Client-Id`: `<Your Cloudflare Access Service Token Client ID>`
  - `CF-Access-Client-Secret`: `<Your Cloudflare Access Service Token Secret>`
- **Payload Constraints**:
  - Automatically assigned `status: 'needs_review'`. Bots cannot publish, approve, or delete stories.
  - Sourced media is capped at 5MB.
  - Stories require editorial approval and legal check clearance before going live on the public site.

---

## Security Audit Hardening Highlights

- **Cryptographic JWT Verification**: Every admin request cryptographically checks the `Cf-Access-Jwt-Assertion` against Cloudflare team public certs (`/cdn-cgi/access/certs`), verifying signature, `exp`, audience `aud`, and issuer `iss`. The `Cf-Access-Authenticated-User-Email` header is never trusted.
- **No Production Dev Bypass**: The development header bypass is disabled in all production builds and only operates if `env.ENVIRONMENT === 'local'` on `localhost`/`127.0.0.1`.
- **HTMLRewriter Allow-list Sanitization**: Story HTML is processed using Cloudflare's native streaming `HTMLRewriter`. Only safe tags are allowed (`p, h2, h3, strong, em, a[href], ul, ol, li, blockquote, figure, figcaption, img[src,alt]`). All dangerous scripts, iframes, and inline event handlers (`onload`, `onclick`) are eliminated.
- **Full Audit Logging**: Every newsroom action (create, edit, publish, unpublish, delete, user change, image upload) records an immutable entry into D1 `audit_log` with user ID, email, action type, article ID, before/after status transition, timestamp, and client IP (`cf-connecting-ip`).
- **Complete Client Bundle Separation**: The public site bundle contains zero admin components, no admin routes, no newsroom links, and no role switchers.
- **Fail-Safe Reliability**: In production, if an API call fails, the application presents a proper error state rather than falling back to fake or mock stories. The admin CMS never pretends to save unpublished articles into browser local storage.

---

## Cloudflare Security Checklist

Before launching to live production, complete this essential security checklist in your Cloudflare dashboard:

1. **Cloudflare Zero Trust (Access) Application**:
   - Create an Access Self-Hosted Application protecting `admin.dailyscot.co.uk`.
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
   - Apply only `migrations/0001_init.sql` to your production D1 instance.
   - Store all credentials (`BOT_CLIENT_ID`, `TURNSTILE_SECRET`, `RESEND_API_KEY`) via `wrangler pages secret put` — never commit secrets to source control or plaintext `[vars]`.

