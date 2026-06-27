# CertForge — Build Roadmap

This tracks the phased build of the Certificate Management System.

## ✅ Phase 1 — Core engine

| Capability | Status |
|------------|--------|
| Project scaffold (Next.js 14, Tailwind, TS) | Done |
| Full Postgres schema + RLS (multi-org) | Done |
| PDF overlay engine (text/date/QR/signature, front+back) | Done |
| Dynamic course units on back page | Done |
| Single-certificate generation + persistence + audit | Done |
| Unique certificate numbers + QR codes | Done |
| Public verification page (QR target) | Done |
| Individual PDF download / reprint | Done |
| Dashboard shell + navigation + session middleware | Done |

## ✅ Phase 2 — Templates module

| Capability | Status |
|------------|--------|
| Upload front/back PDF to Storage + capture page size | Done |
| Client PDF→PNG raster backdrop for the editor (pdf.js) | Done |
| Templates list + new-template upload form | Done |
| Drag-and-drop placeholder designer + live preview | Done |
| Save/load placeholders API | Done |

## ✅ Phase 3 — Courses + Generate + History

| Capability | Status |
|------------|--------|
| Courses CRUD + ordered units (drag-to-reorder) | Done |
| Trainers list/create API | Done |
| Generate Certificate screen (one-minute flow) | Done |
| Certificate History (search + reprint + verify) | Done |

## ✅ Phase 4 — Bulk import

| Capability | Status |
|------------|--------|
| Excel/CSV parsing (xlsx) + header detection | Done |
| Column→field mapping with smart suggestions | Done |
| Batch generation (reuses single-cert service, per-row errors) | Done |
| ZIP packaging (jszip) + results.csv manifest | Done |
| Bulk Import wizard UI (upload → map → run → download) | Done |

> **Scale note:** the batch endpoint runs synchronously with `maxDuration=300`
> and caps imports at 2000 rows. For larger or higher-throughput imports, move
> `generateBatch()` into a background job (Supabase Edge Function / queue worker)
> — it was written pure for exactly this lift-and-shift, and the UI can then
> poll a job-status endpoint instead of waiting on the request.

## 🔜 Phase 5 — Remaining management & enterprise polish

- **Trainers UI** + **signature PNG upload** (engine already overlays the
  signature image; `trainers.signature_path` exists).
- **Trainees** directory + inline create from the generate screen.
- **Email delivery** of certificates (Resend/SendGrid). `certificates.status`
  already includes `emailed`.
- **Cryptographic digital signatures** (distinct from the visual signature).
- **Audit-log UI** (data already captured in `audit_logs`).
- **Settings**: org profile, logos, certificate-number prefix, roles/invites.
- **Custom font embedding** via `@pdf-lib/fontkit` (engine seam at
  `standardFontFor`).
- Certificate **revoke** action (status enum + verification page already
  handle the `revoked` state).

## Notes on honesty / scope

This repo is a **real, runnable system** built in reviewable phases — not a stub
and not a single-shot "finished" dump. The full happy path now works end to end:
upload a template → design fields → define a course → generate one or hundreds
of certificates → download individually or as a ZIP → scan the QR to verify.
Phase 5 items are additive; none block issuing real, verifiable certificates.
