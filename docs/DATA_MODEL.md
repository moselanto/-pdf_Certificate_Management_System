# CertForge — Data Model

PostgreSQL on Supabase. Every domain table is scoped to an organisation and
protected by Row-Level Security (RLS), so a signed-in user can only ever
read/write their own org's rows. The full schema is in
[`db/schema.sql`](../db/schema.sql); incremental changes are in
[`db/migrations/`](../db/migrations) and must be run **in numeric order**.

## Entity overview

```
organizations ──┬── profiles            (users: auth.users + org + role)
                ├── templates ───────── placeholders        (field layout)
                │       └── (logo_path, archived_at)
                ├── courses ─────────── course_units        (ordered list)
                ├── trainers           (signer + signature + institution)
                ├── trainees           (recipients)
                ├── certificates ────── (issued; references template/course/trainer/trainee)
                ├── fonts              (custom TTF/OTF families)
                └── audit_logs         (every meaningful write)
```

## Tables

### `organizations`
Multi-tenant root. `name` (the default "Issued by"), `logo_url` (legacy, unused),
`logo_path` (org **default logo** — fallback for templates with a Logo field but
no own logo; added in migration 007).

### `profiles`
Extends Supabase `auth.users`. One row per user: `org_id`, `full_name`, and
`role` (`owner` | `admin` | `editor` | `viewer`). **A new auth user has no
profile row and sees nothing until one is created** — see SETUP.md step 5.

### `templates`
Reusable certificate background(s): `front_pdf_path` (required), `back_pdf_path`
(optional), `page_width`/`page_height` (points, captured on upload), `logo_path`
(template logo, migration 006), `archived_at` (soft archive, migration 005).

### `placeholders`
Editable fields positioned on a template page. Coordinates are **top-left
origin** in points (the engine converts to pdf-lib's bottom-left at render
time). `kind` enum: `text`, `date`, `qr`, `image`, `signature`, and `course_list`
(migration 004). Columns include `field_key`, `label`, `x/y`, `width/height`,
`font_size`, `font_family`, `color`, `align`, the QR appearance columns
`qr_dark/qr_light/qr_transparent` (migration 002), and `lock_aspect` (migration
007). Scoped to the org **via its parent `template_id`** (no own `org_id`).

### `courses` / `course_units`
A course and its ordered units. Selecting a course at generation time renders
its units on the certificate's back page. `course_units.sort_order` defines the
order; units are scoped via their parent `course_id`.

### `trainers`
The signer. `name`, `title`, `signature_path` (PNG; engine overlays it on a
`signature` placeholder, otherwise the typed name is drawn), and `institution`
(migration 003 — preferred "Issued by" on the verification page).

### `trainees`
Recipients: `name`, `email` (used as the default email-delivery address).

### `certificates`
The source of truth for history & verification. Globally-unique
`certificate_number` (encoded in the QR), references to template/course/trainer/
trainee, `recipient_name`, `issue_date`, a `field_values` JSON **snapshot** (for
faithful reprints), `pdf_path`, `status` (`generated` | `emailed` | `revoked`),
a per-certificate `verification_token`, and the content-integrity
`integrity_hash` + `integrity_alg` (migration 009).

### `fonts`
Custom typefaces (migration 008): `family` (unique per org, referenced by a
placeholder's `font_family`) and `file_path` (the stored .ttf/.otf).

### `audit_logs`
Append-only record of every meaningful write: `actor_id`, `action` (e.g.
`certificate.generate`), `entity`, `entity_id`, and a `metadata` JSON. Powers
the Activity Log (`/audit`).

## Row-Level Security

- A `current_org_id()` helper (SQL, `SECURITY DEFINER` so it doesn't recurse on
  `profiles` — fixed in migration 001) returns the caller's org.
- Standard tables have `org_read` / `org_write` policies of the form
  `org_id = current_org_id()`. `placeholders` and `course_units` inherit the org
  through their parent. `profiles` lets a user read their own row + their org's
  rows and update only their own.
- The **public verification endpoint** is the one place that bypasses RLS: it
  uses the service-role key on the server only, matches the per-certificate
  token, and returns a small non-sensitive field set.
- **Storage** policies (migrations 001 then 010): migration 010 tightens the
  `templates` bucket to strict per-org access (first path segment must equal the
  org id); the `certificates` bucket stays authenticated-readable (year-prefixed,
  served via the service-role client for public verify/download/email).

## Migrations (run in order, idempotent)

| # | File | What it adds |
|---|------|--------------|
| 001 | `001_auth_rls_and_storage.sql` | `current_org_id()` as SECURITY DEFINER; `profiles_read_self`; storage bucket policies |
| 002 | `002_qr_appearance.sql` | `placeholders.qr_dark/qr_light/qr_transparent` |
| 003 | `003_trainer_institution.sql` | `trainers.institution` |
| 004 | `004_course_list_placeholder_kind.sql` | `course_list` value on the `placeholder_kind` enum |
| 005 | `005_template_archive.sql` | `templates.archived_at` |
| 006 | `006_template_logo.sql` | `templates.logo_path` |
| 007 | `007_org_logo_and_aspect.sql` | `organizations.logo_path`, `placeholders.lock_aspect` |
| 008 | `008_custom_fonts.sql` | `fonts` table + RLS |
| 009 | `009_content_integrity.sql` | `certificates.integrity_hash/integrity_alg` |
| 010 | `010_storage_rls_hardening.sql` | per-org Storage policies on the `templates` bucket |

> **Fresh install:** run `db/schema.sql` first (it already includes the 001
> fixes and the base tables), then every migration above in order, then
> optionally `db/seed.sql`. Migrations are safe to re-run.
