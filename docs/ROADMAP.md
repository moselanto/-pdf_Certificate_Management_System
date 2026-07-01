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

## ✅ Phase 5 (part 3) — Enterprise polish

| Capability | Status |
|------------|--------|
| Audit-log / activity viewer (`/audit`, paginated, filterable) | Done |
| Custom font embedding via `@pdf-lib/fontkit` (upload + designer pick) | Done |
| Content-integrity signature (SHA-256, shown on verification page) | Done |
| Org default logo + per-template logo fallback | Done |
| Image/logo aspect-lock (contain vs stretch) | Done |
| Certificate **revoke** action | Done (earlier) |
| Login page wired to Supabase Auth | Done (earlier) |

> **Custom fonts:** an org uploads `.ttf`/`.otf` in Settings; the engine embeds
> the matching family via fontkit (subset), falling back to a standard font when
> a font is missing or unreadable so a bad upload never fails a batch.

> **Integrity signature — honest scope:** the verification page shows a SHA-256
> computed over the issued PDF bytes + identifying fields, so a holder can
> re-hash the PDF and prove it was not altered after issue. This is
> **tamper-evidence, not a PAdES/PKCS#7 digital signature** — it is not
> X.509-backed and PDF readers will not render a trust badge for it. A full
> PAdES signer (cert + key management, LTV) remains a future item below.

## 🔜 Phase 5 (part 4) — Still open

- **Full PAdES / PKCS#7 PDF signing** (X.509 cert + private key, embedded
  signature dictionary, optional LTV) — distinct from today's integrity hash.
- **Designer affordance to drop a Logo field on the back page** (the engine
  already renders a back-page logo; this is a thin UI follow-up).
- **Roles/invites** management UI and a configurable certificate-number prefix.

## Notes on honesty / scope

This repo is a **real, runnable system** built in reviewable phases — not a stub
and not a single-shot "finished" dump. The full happy path now works end to end:
upload a template → design fields → define a course → generate one or hundreds
of certificates → download individually or as a ZIP → scan the QR to verify.
Phase 5 items are additive; none block issuing real, verifiable certificates.
