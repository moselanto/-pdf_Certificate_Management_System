# CertForge — API Reference

All routes are Next.js App Router **route handlers** under `src/app/api`. Unless
noted as **public**, every endpoint:

- requires a signed-in Supabase session (returns `401 { error: "unauthorized" }`
  otherwise);
- resolves the caller's organisation + role from their `profiles` row, and only
  ever reads/writes that organisation's rows (enforced by Row-Level Security);
- returns `403 { error: "forbidden" }` for a `viewer` attempting a write;
- returns errors as `{ "error": "message" }` with a `4xx` status.

Roles: `owner` and `admin` can do everything; `editor` can create/generate but
not change org settings/logo/fonts; `viewer` is read-only.

> Conventions below: **Auth** = minimum role; **Body** = request shape;
> **Returns** = success response. Multipart routes say so explicitly.

---

## Templates

### `GET /api/templates`
List the org's templates. **Auth:** any. **Returns:** `{ templates: [{ id, name, front_pdf_path, back_pdf_path, page_width, page_height, created_at }] }`.

### `POST /api/templates`
Create a template by uploading PDFs. **Auth:** editor+. **Body:** `multipart/form-data` — `name` (string), `front` (PDF File, required), `back` (PDF File, optional). Captures the front PDF's page size. **Returns:** `{ id, pageWidth, pageHeight }`.

### `GET /api/templates/[id]`
Single template + a short-lived signed front-PDF URL (for the thumbnail). **Auth:** any.

### `PATCH /api/templates/[id]`
Set/clear `{ archived: boolean }` (soft archive — hides templates that can't be deleted because certificates reference them). **Auth:** editor+.

### `DELETE /api/templates/[id]`
Delete placeholders + stored PDFs + the row. **Blocked `409`** when certificates reference the template (history is preserved — archive instead). **Auth:** editor+.

### `GET /api/templates/[id]/thumb`
`302` redirect to a signed front-PDF URL (used by the `<object>` thumbnail embed). **Auth:** any.

### `GET /api/templates/[id]/placeholders`
Load the saved field layout. **Returns:** `{ placeholders: Placeholder[] }`.

### `PUT /api/templates/[id]/placeholders`
Replace the **entire** layout (delete-then-insert). **Body:** `{ placeholders: Placeholder[] }`. **Returns:** `{ saved: <count> }`.

### `POST` / `DELETE` / `GET /api/templates/[id]/logo`
Manage the template's own logo. **POST:** `multipart` `logo` File (PNG/JPEG, <2 MB) → `{ logoPath, logoUrl }`. **DELETE:** removes it. **GET:** current signed `{ logoUrl }`. **Auth:** editor+ (GET: any).

### `POST /api/templates/ai-suggest`
Generate several distinct certificate background designs (offline vector — no API key/cost). **Auth:** editor+. **Body:** `{ brief?, purpose?, audience?, tone?, orientation?, includeBack?, count?(1–4), variation? }`. **Returns:** `{ suggestions: [{ id, styleId, name, description, palette, fields, backPage?, imageUrl, imageContentUri, orientation }], source: "offline" }`.

### `POST /api/templates/from-ai`
Create a real template from a chosen AI background — no manual upload. **Auth:** editor+. **Body:** `{ imageStoragePath, name, styleId?, orientation?, includeBack? }`. Re-renders the front from `styleId`, optionally adds a blank back page, inserts the template row, and **auto-places the standard placeholders** (recipient, course, date, signature, institution, cert number, QR keyed `qr_code`, and a back-page course list). **Returns:** `{ id, pageWidth, pageHeight }`.

---

## Courses

### `GET /api/courses`
List courses with unit counts. **Returns:** `{ courses: [{ id, title, description, unitCount }] }`.

### `POST /api/courses`
**Auth:** editor+. **Body:** `{ title, description? }` → `{ id }`.

### `GET` / `DELETE /api/courses/[id]`
Fetch one course; delete it (blocked `409` if certificates reference it). **DELETE auth:** editor+.

### `GET` / `PUT /api/courses/[id]/units`
Load ordered units; replace the full ordered set. **PUT body:** `{ units: [{ title }] }` (order = array order). **Auth:** editor+ for PUT.

---

## Trainers & Trainees

### `GET` / `POST /api/trainers`
List / create trainers. **POST body:** `{ name, title?, institution? }`. **Auth:** editor+ for POST.

### `GET` / `PATCH / DELETE /api/trainers/[id]`
Fetch / edit (`{ name?, title?, institution? }`) / delete. Delete nulls the trainer reference on existing certificates (history kept via the `field_values` snapshot). **Auth:** editor+ for writes.

### `POST /api/trainers/[id]/signature`
Upload a PNG signature image (stored; engine overlays it on a `signature` placeholder). **Auth:** editor+. **Body:** `multipart` `signature` File (PNG).

### `GET` / `POST /api/trainees`
Searchable list (`?q=`) / create. **POST body:** `{ name, email? }`. **Auth:** editor+ for POST.

### `PATCH` / `DELETE /api/trainees/[id]`
Edit / delete a trainee (delete blocked if certificates reference it). **Auth:** editor+.

---

## Certificates

### `POST /api/certificates`
Generate & persist one certificate. **Auth:** editor+. **Body:** `{ templateId, courseId?, trainerId?, traineeId?, recipientName, issueDate (ISO), values? }`. **Returns:** `{ id, certificateNumber, pdfPath }`.

### `GET /api/certificates`
History for the org, newest first. **Query:** `?q=` matches recipient name or certificate number. **Returns:** `{ certificates: [{ id, certificate_number, recipient_name, issue_date, status, created_at }] }`.

### `GET` / `DELETE /api/certificates/[id]`
Fetch one; **hard-delete** (removes stored PDF + row + audit entry). Distinct from revoke. **Auth:** editor+ for delete.

### `GET /api/certificates/[id]/download`
Stream the stored PDF. **Query:** `?inline=1` for in-browser preview (`Content-Disposition: inline`); default forces download.

### `POST /api/certificates/[id]/email`
Email the certificate (attaches the PDF, flips status to `emailed`, audits). **Auth:** editor+. **Body:** `{ to? }` — falls back to the linked trainee's email. Requires `RESEND_API_KEY` + `CERT_EMAIL_FROM` or returns a clear "email not configured" error.

### `POST /api/certificates/[id]/revoke`
Flip status to `revoked` (or restore with `{ revoke: false }`). The verification page then shows "Certificate revoked". Audited. **Auth:** editor+.

---

## Bulk import

### `POST /api/bulk/parse`
Parse an uploaded spreadsheet's headers + preview rows and suggest a column→field mapping. **Auth:** editor+. **Body:** `multipart` `file` (.xlsx/.xls/.csv). **Returns:** headers, preview, suggested mapping.

### `POST /api/bulk/generate`
Generate every row and stream back a ZIP (+ `results.csv` manifest). **Auth:** editor+. **Body:** `multipart` `file` + `config` (JSON: `{ templateId, courseId?, trainerId?, mapping, issueDate }`). `mapping.recipient_name` is required. Per-row errors are isolated (one bad row never fails the batch). Response headers `X-Batch-Total/Succeeded/Failed` surface stats. `maxDuration=300`, 2000-row cap.

---

## Live preview

### `POST /api/preview`
Render the **current unsaved** editor layout + sample values to a PDF, persisting nothing. **Body:** `{ templateId, placeholders, values? }`. Injects a sample QR, the template logo, and sample course units (when a course-list box or back page exists) so the preview matches the printed result. **Returns:** the PDF inline (`application/pdf`).

---

## Settings, fonts, audit

### `GET` / `PATCH / POST / DELETE /api/settings`
Org settings. **GET:** `{ orgName, logoUrl, email, role }`. **PATCH:** `{ orgName }` (owner/admin). **POST:** `multipart` `logo` (org default logo, PNG/JPEG <2 MB, owner/admin). **DELETE:** remove the default logo. Audited.

### `GET` / `POST / DELETE /api/fonts`
Custom fonts. **GET:** `{ fonts: [{ id, family, created_at }] }`. **POST:** `multipart` `family` (string) + `font` (.ttf/.otf <2 MB); upserts per `(org, family)`. **DELETE:** `?id=`. **Auth:** editor+ for writes.

### `GET /api/audit`
Org activity feed, newest first. **Query:** `limit` (≤200), `action` (prefix filter, e.g. `certificate.`), `before` (ISO cursor). **Returns:** `{ entries: [{ id, action, entity, entityId, metadata, createdAt, actorName }], nextBefore }`.

---

## Verification (PUBLIC)

### `GET /api/verify/[number]?t=<token>`
**No auth.** Server-side service-role read that returns a deliberately small,
non-sensitive field set and requires the per-certificate `verification_token`
to match. **Returns:** `{ valid, revoked, certificateNumber, recipientName, issueDate, organization, course, integrityHash, integrityAlg }`. "Issued by" priority: signing trainer's institution → org name → `CERT_ISSUER_NAME`.

---

## Auth callback / sign-out (route handlers, not JSON APIs)

- `GET /auth/callback` — exchanges a Supabase email-confirm/OAuth code for a session, then redirects into the dashboard.
- `POST /auth/signout` — clears the session cookie and returns to `/login`.

---

## The `Placeholder` shape

Used by the designer, preview, and placeholder APIs (see `src/lib/domain/types.ts`):

```ts
{
  id: string;
  page: "front" | "back";
  kind: "text" | "date" | "qr" | "image" | "signature" | "course_list";
  fieldKey: string;        // resolves to a value at generation time, e.g. "recipient_name"
  label: string;
  x: number; y: number;    // PDF points, TOP-LEFT origin (engine converts to bottom-left)
  width?: number; height?: number;
  fontSize: number;
  fontFamily: string;      // a standard font OR an uploaded custom font family
  color: string;           // hex "#RRGGBB"
  align: "left" | "center" | "right";
  qrDark?: string; qrLight?: string; qrTransparent?: boolean;  // QR only
  lockAspect?: boolean;    // image/signature: contain (don't stretch)
}
```

Special field keys the engine fills automatically: `recipient_name`, `issue_date`,
`certificate_number`, `trainer_signature`, `qr_code` (QR image), `logo` (template
or org logo image), and `course_units` (the dynamic course-list box).
