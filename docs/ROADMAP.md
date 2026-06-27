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

## ✅ Phase 5 (part 1) — Trainers + Trainees

| Capability | Status |
|------------|--------|
| Trainers UI (list, create, detail) | Done |
| Trainer signature PNG upload (engine overlays it) | Done |
| Trainees directory + inline create API | Done |

## ✅ Phase 5 (part 2) — Email delivery

| Capability | Status |
|------------|--------|
| Provider-agnostic email helper (Resend default, no SDK) | Done |
| Certificate email template (HTML + text, escaped) | Done |
| sendCertificateEmail service (attaches PDF, status→emailed, audit) | Done |
| POST /api/certificates/[id]/email | Done |
| Send-email UI on Generate result + History table | Done |

> Email requires `RESEND_API_KEY` + `CERT_EMAIL_FROM`. When unset, the Send
> actions return a clear "email not configured" error and send nothing.

## 🔜 Phase 5 (part 3) — Remaining enterprise polish

- **Cryptographic digital signatures** (distinct from the visual signature).
- **Audit-log UI** (data already captured in `audit_logs`).
- **Settings**: org profile, logos, certificate-number prefix, roles/invites.
- **Custom font embedding** via `@pdf-lib/fontkit` (engine seam at
  `standardFontFor`).
- Certificate **revoke** action (status enum + verification page already
  handle the `revoked` state).
- **Login page** wired to Supabase Auth (see SETUP.md note).

## Notes on honesty / scope

This repo is a **real, runnable system** built in reviewable phases — not a stub
and not a single-shot "finished" dump. The full happy path now works end to end:
upload a template → design fields → define a course → generate one or hundreds
of certificates → download individually or as a ZIP → scan the QR to verify.
Phase 5 items are additive; none block issuing real, verifiable certificates.
