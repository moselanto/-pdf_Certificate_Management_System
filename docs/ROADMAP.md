# CertForge — Build Roadmap

This foundation (Phase 1) delivers the **core engine** end-to-end. Below is the
honest status of every module in the original spec and what remains.

## ✅ Phase 1 — Core engine (this commit)

| Capability | Status |
|------------|--------|
| Project scaffold (Next.js 14, Tailwind, TS) | Done |
| Full Postgres schema + RLS (multi-org) | Done |
| PDF overlay engine (text/date/QR/signature, front+back) | Done |
| Dynamic course units on back page | Done |
| Drag-and-drop placeholder editor + field inspector | Done |
| Live PDF preview | Done |
| Single-certificate generation + persistence + audit | Done |
| Unique certificate numbers + QR codes | Done |
| Public verification page (QR target) | Done |
| Individual PDF download / reprint | Done |
| Dashboard shell + navigation | Done |
| Session middleware + role checks | Done |

## 🔜 Phase 2 — CRUD UIs (next)

These modules have schema + (mostly) API, but need full management screens:
- **Templates**: upload front/back PDF → capture page size → open designer.
  *Needs:* upload route + PDF→PNG raster for the editor background (pdf.js or a
  server raster). The designer component itself is built.
- **Courses**: course + ordered units editor.
- **Trainers**: incl. signature PNG upload.
- **Trainees**: directory + inline create from the generate screen.
- **Certificate History**: searchable table (the `GET /api/certificates`
  endpoint with `?q=` search already exists) + reprint/revoke actions.

## 🔜 Phase 3 — Bulk & delivery

- **Bulk import**: parse Excel/CSV with `xlsx`, map columns → fields, loop
  `generateCertificate()` (already reusable), bundle with `jszip` into a ZIP.
  Recommend a job queue (e.g. Supabase Edge Function or a worker) for hundreds
  of certs so requests don't time out. The schema has everything needed.
- **Email delivery**: send certificates to trainees (Resend/SendGrid). The
  `certificates.status` enum already includes `emailed`.
- **ZIP archive download** for a batch.

## 🔜 Phase 4 — Polish & enterprise

- **Digital signatures** (cryptographic PDF signing, distinct from the visual
  signature image already supported).
- **Audit log UI** (data is already captured in `audit_logs`).
- **Settings**: org profile, logos, certificate-number prefix, roles/invites.
- **Custom font embedding** via `@pdf-lib/fontkit` (engine has a clear seam at
  `standardFontFor`).
- Multiple logos per org, template versioning.

## Notes on honesty / scope

The original brief is a multi-week build for a team. This repo is a **real,
runnable foundation** — not a stub and not the finished product. The hardest,
most reusable pieces (the pure overlay engine, the schema with RLS, the
generation service, verification) are done and designed so Phases 2–4 are
mostly wiring UI to endpoints that already follow a consistent pattern.
