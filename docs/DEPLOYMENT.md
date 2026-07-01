# Deploying CertForge

CertForge is a **Next.js 14 (App Router) app with a Supabase backend**
(Postgres + Auth + Storage). It is a server app, not a static site — it needs a
Node.js runtime to serve its API routes (`/api/certificates`, `/api/verify`, …).

You do **not** need VS Code or a local build to go live. The recommended path
builds everything in the cloud straight from GitHub.

---

## Recommended: Vercel + your existing domain

Everything below is done in the browser. Your code is already on GitHub.

### 1. Make sure `main` is deploy-ready
Merge the feature branch (`certforge-foundation`) into `main` via the pull
request so `main` contains the finished app. Vercel deploys `main` by default.

### 2. Import the repo into Vercel
1. Go to https://vercel.com and sign up / log in **with GitHub**.
2. **Add New → Project → Import** the `-pdf_Certificate_Management_System` repo.
3. Vercel auto-detects Next.js — leave the build settings at their defaults
   (`npm install`, `next build`). The install + build run **on Vercel**, so
   the local "Module not found: @pdf-lib/fontkit" error does not apply here.

### 3. Add environment variables
In the import screen (or Project → Settings → Environment Variables), add the
four variables from `.env.example`:

| Variable | Where it comes from | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **Server only — never expose** |
| `NEXT_PUBLIC_APP_URL` | Your production domain | e.g. `https://certforge.yourdomain.com` |

> **Critical:** `NEXT_PUBLIC_APP_URL` must be your real production domain. The
> certificate **QR codes and `/verify` links are built from it** — if it is
> wrong, scanned certificates will not verify.

### 4. Deploy
Click **Deploy**. Vercel builds and gives you a temporary
`*.vercel.app` URL to confirm it works.

### 5. Attach your domain
1. Vercel → Project → **Domains** → add your domain (or a subdomain like
   `certforge.yourdomain.com`).
2. Vercel shows a DNS record (usually a `CNAME`, or an `A` record for a root
   domain). Add it in **cPanel → Zone Editor** (or at your registrar).
3. Wait for DNS to propagate. HTTPS (Let's Encrypt) is issued automatically.
4. Once the domain is live, set `NEXT_PUBLIC_APP_URL` to it and redeploy so QR
   links use the real domain.

### 6. Set up the database (one-time, on Supabase)
In the Supabase dashboard → **SQL Editor**, run in order:
1. `db/schema.sql`
2. Every migration in `db/migrations/` **in numeric order: 001 → 010**
3. (Optional) `db/seed.sql` for demo data
4. Create the **Storage buckets** the app expects (for template PDFs and
   generated certificates), and confirm the per-org Storage RLS from
   migration 010 is in place.

### 7. Create the first user
Supabase Auth creates the login; the app needs a matching `profiles` row
(org + role). See `docs/SETUP.md` for linking the first admin profile.

After this, **every push to GitHub auto-redeploys** — no local tooling needed.

---

## Alternative: cPanel "Setup Node.js App"

Only viable if your cPanel plan has the **Setup Node.js App** feature with
**Node 18 or 20**. It keeps the app on your own hosting but is more manual.

1. In GitHub, use **Code → Download ZIP** of the repo.
2. **cPanel → File Manager**: upload and extract the ZIP (skip `node_modules`).
3. **cPanel → Setup Node.js App**: set the application root, pick Node 18/20,
   then use the panel's buttons to run **`npm install`** and the **build**
   (the server builds it — not your laptop).
4. Add the same four environment variables in that panel.
5. Start command: `npm run start`. Point the domain at the app; enable AutoSSL.
6. Do the same Supabase database setup as in step 6 above (Supabase stays the
   backend; you are only hosting the app code on cPanel).

> If your cPanel has **no** Node.js support (PHP/MySQL only), CertForge cannot
> run there as-is. Use the Vercel path above and simply point your cPanel
> domain's DNS at Vercel — you keep the domain and email you already pay for.

---

## Environment variables reference
See [`.env.example`](../.env.example) for the full list with example shapes.
Never commit real secret values; set them in the host's env panel.

## Pre-deploy checklist
- [ ] `certforge-foundation` merged into `main`
- [ ] Supabase project created; `schema.sql` + migrations 001–010 run; buckets created
- [ ] Four env vars set on the host (with the **real** domain in `NEXT_PUBLIC_APP_URL`)
- [ ] Domain attached and HTTPS active
- [ ] First admin `profiles` row linked (see `docs/SETUP.md`)
- [ ] Generated one test certificate and confirmed its QR `/verify` link resolves on the live domain
