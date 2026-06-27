# CertForge — Setup Guide

This walks you from an empty machine to issuing your first verifiable
certificate. Plan for ~20 minutes the first time.

## Prerequisites

- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) account
- A certificate design as a **PDF** (front page; optionally a back page)

---

## 1. Create a Supabase project

1. Go to https://supabase.com → New project. Pick a name and a strong DB password.
2. Once it's ready, open **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)

## 2. Apply the database schema

1. In Supabase, open **SQL Editor → New query**.
2. Paste the contents of [`db/schema.sql`](../db/schema.sql) and **Run**.
3. (Optional demo data) Paste [`db/seed.sql`](../db/seed.sql) and **Run**.
   This creates a demo organization, template row, course, and trainer.

> The schema enables Row-Level Security on every table, so the app only ever
> shows a user their own organization's data.

## 3. Create Storage buckets

In **Storage → Create bucket**, create two **private** buckets:

| Bucket name   | Purpose                                  |
|---------------|------------------------------------------|
| `templates`   | Uploaded template PDFs + trainer signatures |
| `certificates`| Generated certificate PDFs               |

(If you rename them, update `SUPABASE_TEMPLATE_BUCKET` / `SUPABASE_CERTIFICATE_BUCKET` in your env.)

## 4. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_TEMPLATE_BUCKET=templates
SUPABASE_CERTIFICATE_BUCKET=certificates

# Email delivery (optional, Phase 5 — see below)
RESEND_API_KEY=
CERT_EMAIL_FROM="CertForge <certificates@yourdomain.com>"
```

## 5. Create your first user + profile

CertForge uses Supabase Auth. Each user needs a `profiles` row linking them to
an organization and a role.

1. In Supabase → **Authentication → Users → Add user**, create a user with an
   email + password. Copy the new user's **UID**.
2. In **SQL Editor**, run (using the demo org from `seed.sql`, or your own org id):

```sql
insert into profiles (id, org_id, full_name, role)
values (
  'PASTE-AUTH-USER-UID',
  '00000000-0000-0000-0000-000000000001', -- demo org id from seed.sql
  'Your Name',
  'owner'
);
```

> Roles: `owner`, `admin`, `editor` can generate; `viewer` is read-only.

## 6. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the user you created.

> **Note on auth UI:** this foundation ships the session middleware and
> role-aware API routes. If you don't yet have a `/login` page wired to
> Supabase Auth, the quickest path for local testing is Supabase's hosted auth
> or adding `@supabase/auth-ui-react`. A dedicated login page is a small,
> well-scoped addition — ask and it can be added.

## 7. Issue your first certificate

1. **Templates → New template** → upload your front PDF (and back, if any).
2. In the designer, drag fields (Recipient Name, Issue Date, QR, etc.) onto the
   page, then **Save layout**. Use **Live preview** to confirm placement.
3. **Courses → New course** → add a few units (these fill the back page).
4. **Generate certificate** → pick template + course + trainer, type a name,
   click **Generate** → **Download PDF**.
5. Scan the QR (or click **Open verification page**) to see the public
   verification result.

## Run the tests

```bash
npm test
```

This runs the pure pdf-lib engine unit tests (no Supabase needed).

---

## Troubleshooting

- **"unauthorized" from API routes** — you're not signed in, or your auth user
  has no matching `profiles` row (step 5).
- **Template upload fails** — confirm the `templates` bucket exists and the file
  is a real PDF.
- **Editor backdrop blank** — the browser couldn't fetch/rasterize the template
  PDF; check the signed URL isn't expired (re-open the template page).
- **QR points to localhost** — set `NEXT_PUBLIC_APP_URL` to your deployed URL in
  production so QR codes resolve publicly.
