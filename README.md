# CertForge — Certificate Management System

A modern web-based Certificate Management System that lets non-technical administrators
generate professional, print-ready PDF certificates from reusable PDF templates — no
Photoshop required.

> **Status: Phase 1 — Core Engine (foundation).** This commit delivers a runnable
> foundation: project scaffold, full database schema, the pdf-lib overlay engine,
> the drag-and-drop placeholder editor, single-certificate generation, and the public
> verification page. Bulk import, email delivery, digital signatures, and audit-log UI
> are stubbed with a clear roadmap (see `docs/ROADMAP.md`).

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 14 (App Router)** | Server components + route handlers in one codebase |
| UI | **React + Tailwind CSS** | Fast, responsive, consistent design system |
| Backend/DB | **Supabase (PostgreSQL)** | Managed Postgres + Auth + Storage + Row-Level Security — fastest path to multi-tenant |
| PDF | **pdf-lib** | Overlays text/QR onto uploaded PDFs while preserving original quality |
| QR | **qrcode** | Generates QR PNGs embedded into the PDF + verification URL |
| Excel/CSV | **xlsx** | Bulk import parsing |
| ZIP | **jszip** | Bundle hundreds of generated PDFs |

## Architecture (clean / layered)

```
src/
  app/                 # Next.js routes (UI + API route handlers)
    (dashboard)/       # Authenticated admin app
    verify/[number]/   # PUBLIC certificate verification page (QR target)
    api/               # Route handlers (generation, upload, verify)
  components/          # Reusable UI components
  lib/
    pdf/               # PDF overlay engine (pure, testable — no Next.js deps)
    supabase/          # DB client + typed queries
    domain/            # Domain types & validation (zod schemas)
    qr/                # QR generation helper
  styles/
db/
  schema.sql           # Full Postgres schema + RLS policies
  seed.sql             # Demo org, template, course, trainer
docs/
  ARCHITECTURE.md
  ROADMAP.md
```

The `lib/pdf` engine is intentionally **framework-agnostic and pure** so it can be unit
tested and reused (e.g. in a queue worker for bulk jobs) without booting Next.js.

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase keys
npm install
# Apply the schema in the Supabase SQL editor (db/schema.sql, then db/seed.sql)
npm run dev
```

See `docs/ARCHITECTURE.md` for the full design and `docs/ROADMAP.md` for what's next.
