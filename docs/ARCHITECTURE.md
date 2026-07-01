# CertForge — Architecture

> **Related docs:** [`API.md`](API.md) (every HTTP route), [`DATA_MODEL.md`](DATA_MODEL.md)
> (tables, RLS, migrations), [`SETUP.md`](SETUP.md) (install), and
> [`USER_MANUAL.md`](USER_MANUAL.md) (end-user guide).

## Layers

```
UI (React components, Tailwind)
        │  fetch
Route handlers (src/app/api/*)        ← thin: auth + validation + delegate
        │
Services (src/lib/services/*)         ← orchestration (generateCertificate)
        │
Engine (src/lib/pdf/*, qr/*)          ← PURE, no Next/Supabase deps, unit-testable
        │
Data (src/lib/supabase/*)             ← typed DB + storage access, RLS-scoped
        │
PostgreSQL + Storage (Supabase)
```

### Why this split

- **Engine is pure.** `renderCertificate()` takes bytes + plain objects and
  returns bytes. It has zero knowledge of HTTP, auth, or the database, so it can
  be unit-tested in isolation and later reused inside a queue worker for bulk
  generation without dragging Next.js along.
- **Services orchestrate.** `generateCertificate()` is the single place that
  knows how to assemble a certificate end-to-end (resolve template, course
  units, trainer signature, QR, persist, audit). Both the single-cert API and
  the future bulk-import worker call the same function — no duplicated logic.
- **Route handlers stay thin.** They authenticate, validate input with zod, and
  delegate. Easy to reason about and secure.

## Coordinate system

The editor uses a **top-left origin** in PDF points (what users intuitively
expect). pdf-lib uses a **bottom-left origin**. The conversion lives in exactly
one place — `overlay.ts` — so the rest of the system never has to think about
it. This is why the live preview matches the printed PDF pixel-for-pixel.

## Multi-tenancy & security

- Every domain table is `org_id`-scoped with **Row-Level Security**. A logged-in
  user can only ever read/write their own organization's rows — enforced at the
  database, not just the app.
- The **public verification endpoint** is the one place that bypasses RLS (it
  has no user session). It uses the service-role key on the server only, matches
  a per-certificate `verification_token`, and returns a deliberately small,
  non-sensitive field set.
- Role-based access (`owner/admin/editor/viewer`) is checked in route handlers;
  `viewer` cannot generate.

## Faithful reprints

Every certificate row stores a `field_values` JSON snapshot **and** the rendered
PDF in Storage. Reprints serve the stored PDF, so a certificate looks identical
years later even if the template is edited afterward.

## Data flow: generating a certificate

1. Admin picks template + course + trainer + recipient in `/generate`.
2. `POST /api/certificates` → `generateCertificate()`.
3. Service downloads the template PDF(s), resolves course units & signature,
   mints a unique certificate number + token, renders the QR, overlays
   everything via the engine.
4. PDF uploaded to Storage; `certificates` + `audit_logs` rows written.
5. QR on the certificate points to `/verify/<number>?t=<token>` — a public page
   anyone can scan to confirm authenticity.
