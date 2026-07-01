# CertForge — Certificate Management System

A web-based Certificate Management System that lets non-technical administrators
generate professional, print-ready PDF certificates from reusable PDF templates —
no design software required. Design a template once, then issue one certificate
or hundreds, each with a unique number and a scannable QR code that anyone can
verify online.

> **Status: feature-complete happy path.** The full flow works end to end —
> upload or AI-generate a template, design fields, define a course, issue one or
> hundreds of certificates, download individually or as a ZIP, email them, and
> verify by QR scan. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's done and
> what remains (notably full PAdES digital signing).

## Documentation

| Doc | For whom | What it covers |
|-----|----------|----------------|
| [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) | **End users / admins** | Plain-language, step-by-step guide to using every screen |
| [`docs/SETUP.md`](docs/SETUP.md) | Operators | Empty machine → first verifiable certificate (~20 min) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Developers | The layered design and why it's shaped this way |
| [`docs/API.md`](docs/API.md) | Developers | Every HTTP route: method, auth, body, response |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Developers | Tables, columns, relationships, RLS, and migrations |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Everyone | Phase-by-phase status and open items |

## What you can do

- **Templates** — upload a front/back PDF, or **generate a background with the
  offline AI designer** (no API key, no cost), then drag fields (recipient name,
  course, date, signature, QR, logo, course list) onto the page with a live
  preview that matches the printed PDF.
- **Courses** — define a course and its ordered units; the units render on the
  certificate's back page automatically.
- **Trainers & trainees** — manage signers (with a typed or uploaded signature)
  and recipients.
- **Generate** — issue a single certificate in about a minute; download, preview,
  or email it.
- **Bulk import** — upload an Excel/CSV, map columns to fields, and generate
  hundreds of certificates packaged as a ZIP with a results manifest.
- **History** — search, reprint, email, revoke/restore, or delete certificates.
- **Verify** — every certificate carries a QR code linking to a public
  verification page, plus a SHA-256 content-integrity fingerprint.
- **Activity log** — a filterable feed of every meaningful change.
- **Settings** — organisation name, default logo, and custom fonts.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 14 (App Router)** | Server components + route handlers in one codebase |
| UI | **React + Tailwind CSS** | Fast, responsive, consistent design system |
| Backend/DB | **Supabase (PostgreSQL)** | Managed Postgres + Auth + Storage + Row-Level Security — fastest path to multi-tenant |
| PDF | **pdf-lib** (+ `@pdf-lib/fontkit`) | Overlays text/QR/images onto uploaded PDFs while preserving original quality; embeds custom fonts |
| QR | **qrcode** | Generates QR PNGs embedded into the PDF + verification URL |
| Excel/CSV | **xlsx** | Bulk import parsing |
| ZIP | **jszip** | Bundle hundreds of generated PDFs |
| Tests | **vitest** | Fast unit tests for the pure engine |

## Project layout

```
src/
  app/                 # Next.js routes (UI + API route handlers)
    (dashboard)/       # Authenticated admin app (templates, courses, generate, history, audit, settings…)
    verify/[number]/   # PUBLIC certificate verification page (QR target)
    login/             # Supabase Auth sign-in / sign-up
    auth/              # OAuth/email-confirm callback + sign-out
    api/               # Route handlers (see docs/API.md)
  components/          # Reusable UI components (designer, inspector, cards…)
  lib/
    pdf/               # PDF overlay engine + background generator + integrity hash (PURE, unit-tested)
    services/          # Orchestration (generateCertificate, sendCertificateEmail…)
    supabase/          # DB client + storage helpers
    domain/            # Domain types & zod validation
    qr/                # QR generation helper
    bulk/              # Spreadsheet parse + batch generate + ZIP
  styles/
db/
  schema.sql           # Full Postgres schema + RLS policies
  seed.sql             # Demo org, template, course, trainer
  migrations/          # Numbered, idempotent migrations (001…010) — run in order
docs/                  # See the Documentation table above
ci/ci.yml              # CI workflow (move to .github/workflows/ to activate — see ROADMAP)
```

The `lib/pdf` engine is intentionally **framework-agnostic and pure** so it can be
unit-tested and reused (e.g. in a queue worker for bulk jobs) without booting
Next.js.

## Getting started (short version)

```bash
cp .env.example .env.local        # fill in your Supabase keys
npm install
# In the Supabase SQL editor: run db/schema.sql, then every db/migrations/*.sql in
# numeric order, then (optionally) db/seed.sql. See docs/SETUP.md for details.
npm run dev                       # http://localhost:3000
npm test                          # run the engine unit tests
```

For the full walkthrough — Supabase project, Storage buckets, environment, first
user, first certificate, and troubleshooting — see [`docs/SETUP.md`](docs/SETUP.md).

## A note on honesty / scope

This is a **real, runnable system** built in reviewable phases, not a stub. The
happy path works end to end. Two scope boundaries are called out explicitly so
nobody is surprised:

- The certificate **content-integrity signature** is a SHA-256 fingerprint
  (tamper-evidence), **not** a PAdES/PKCS#7 digital signature — PDF readers will
  not show a trust badge for it. Full PAdES signing is a tracked roadmap item.
- The **CI workflow** ships at `ci/ci.yml` and must be moved to
  `.github/workflows/ci.yml` to run (the original commit token lacked the
  `workflow` scope). See [`docs/ROADMAP.md`](docs/ROADMAP.md).
