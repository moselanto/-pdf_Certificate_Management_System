# CertForge — User Manual

A plain-language guide to using CertForge. No technical background needed. If
you are *installing* CertForge for the first time, see
[`SETUP.md`](SETUP.md) instead; this manual assumes someone has set it up and
given you a login.

## Contents

1. [Signing in](#1-signing-in)
2. [The big picture](#2-the-big-picture)
3. [Quick start: issue your first certificate in about a minute](#3-quick-start)
4. [Creating a certificate template](#4-creating-a-certificate-template)
   - [Option A — upload your own PDF design](#option-a--upload-your-own-pdf-design)
   - [Option B — generate a design with the AI helper](#option-b--generate-a-design-with-the-ai-helper)
   - [Placing fields in the designer](#placing-fields-in-the-designer)
5. [Setting up courses](#5-setting-up-courses)
6. [Trainers and trainees](#6-trainers-and-trainees)
7. [Generating one certificate](#7-generating-one-certificate)
8. [Bulk import: many certificates at once](#8-bulk-import)
9. [Certificate history](#9-certificate-history)
10. [How verification works](#10-how-verification-works)
11. [The activity log](#11-the-activity-log)
12. [Settings: name, logo, and fonts](#12-settings)
13. [Who can do what (roles)](#13-roles)
14. [Frequently asked questions](#14-faq)

---

## 1. Signing in

Open the CertForge web address your administrator gave you. You'll see a
**login** screen. Enter your email and password and select **Sign in**. If you
don't have an account yet, use **Sign up** to create one — then ask an
administrator to link you to your organisation so you can see your data.

To sign out, use the menu in the top-right corner of the screen.

---

## 2. The big picture

CertForge turns a reusable design into real, verifiable certificates. The flow
is always the same:

> **Template** (the design) **+ Course** (what they completed) **+ Recipient**
> (who) → **Certificate** (a PDF with a unique number and a QR code).

You set up the template and course once. After that, issuing a certificate
takes about a minute, and you can issue hundreds at once from a spreadsheet.

The menu on the left has everything: **Templates, Courses, Trainers, Trainees,
Generate Certificate, Certificate History, Bulk Import, Activity Log,** and
**Settings**.

---

## 3. Quick start

If a template and a course already exist, here's the whole flow:

1. Select **Generate Certificate** in the left menu.
2. Choose a **Template**, a **Course**, and a **Trainer**.
3. Pick a saved **Recipient**, or choose "New recipient" and type their name.
4. Confirm the **Issue date**.
5. Select **Generate**.

You'll immediately get the **certificate number**, a **Download PDF** button, a
**Preview** button, and a **verification link**. Done.

If you don't have a template or course yet, keep reading.

---

## 4. Creating a certificate template

A template is the reusable background design plus the positions of the fields
(name, date, QR code, and so on). Go to **Templates → New template**. You have
two ways to get a design.

### Option A — upload your own PDF design

If you already have a certificate design (from a designer, Canva, Word exported
to PDF, etc.):

1. Give the template a **name**.
2. Upload your **front** PDF. Optionally upload a **back** PDF (often used for
   the list of course units).
3. Save — you'll land in the **designer**, where you place the fields.

> Tip: if you don't upload a back page but your course has units, CertForge
> automatically adds a clean back page listing them.

### Option B — generate a design with the AI helper

No design? Use the built-in **AI template helper** on the Templates page. It
generates several polished certificate backgrounds for you — instantly, on your
own server, with no external service, no API key, and no cost.

1. Open the **AI template helper** and (optionally) describe the purpose,
   audience, or tone. Choose landscape or portrait.
2. Review the generated designs. Select **Generate more** for a fresh set.
3. Select **Use this template** on the one you like. CertForge creates the
   template *and* automatically places the standard fields for you (name,
   course, date, signature, institution, certificate number, QR code, and a
   back-page course list).

You can then fine-tune any field in the designer.

### Placing fields in the designer

The designer shows your page with draggable **field chips**. A panel on the
side (the **field inspector**) edits whatever field is selected.

Common fields:

| Field | What it prints |
|-------|----------------|
| **Recipient name** | The person's name |
| **Course / programme title** | The course name |
| **Issue date** | The date issued |
| **Trainer signature** | The trainer's uploaded signature image, or their typed name |
| **Issuing institution** | Your organisation / the trainer's institution |
| **Certificate number** | The unique number |
| **Verification QR code** | The QR people scan to verify |
| **Logo** | Your template or organisation logo |
| **Course list** | The course's units (usually on the back page) |

How to work:

- **Drag** a chip to move it. The on-screen position matches the printed PDF
  exactly.
- Select a chip to edit it: change the **font, size, colour, and alignment**.
- Use the **Front / Back** toggle to design each page. New course-list fields
  default to the back page.
- For the **QR code**, you can change the colour or make the background
  transparent — handy on dark designs (set white modules + transparent).
- For **Logo** and **signature** fields, tick **Keep aspect ratio** so the image
  fits without stretching.
- Select **Center selected on page** to snap a field to the exact middle.
- Select **Live preview** at any time to see a real PDF with sample values —
  this is exactly what will print.
- Select **Save layout** when you're happy.

> What-you-see-is-what-you-print: the preview and the final certificate use the
> same engine, so placement is reliable.

---

## 5. Setting up courses

A course is what the certificate certifies. Its **units** print on the back
page automatically.

1. Go to **Courses → New course**, give it a title (and optional description).
2. Open the course and **add units** (e.g. "Data Entry Accuracy", "Quality
   Assurance").
3. **Drag to reorder** units — that's the order they print in.

---

## 6. Trainers and trainees

**Trainers** are the people who sign certificates.

- Go to **Trainers → New trainer**. Add a name, optional title, and optional
  **institution** (this can appear as the "Issued by" line on the verification
  page).
- Open a trainer to **upload a signature image** (PNG). If you don't upload one,
  the trainer's typed name is drawn as the signature instead.

**Trainees** are the people who receive certificates.

- Go to **Trainees** to add recipients (name + optional email). Saving people
  here means you can pick them from a list when generating, and email their
  certificate to them directly.

You don't *have* to pre-add a trainee — you can also type a fresh name at
generation time.

---

## 7. Generating one certificate

1. Select **Generate Certificate**.
2. Choose the **Template**, **Course**, and **Trainer**.
3. Choose a saved **Recipient** (auto-fills their name and email) or pick
   "New recipient" to type a name.
4. Confirm the **Issue date**.
5. Select **Generate**.

After it's created you can:

- **Download PDF** — save the certificate.
- **Preview PDF** — open it in a new tab without downloading.
- **Email** — send it to the recipient (uses the trainee's email, or type
  another address). *Email only works if your administrator has configured email
  delivery; otherwise you'll see a clear "email not configured" message.*
- Copy the **verification link** or scan the QR.

---

## 8. Bulk import

Issue many certificates at once from a spreadsheet.

1. Prepare an **Excel or CSV** file with one row per recipient. Include at least
   a column for the recipient's name (an email column is recommended).
2. Go to **Bulk Import**.
3. **Step 1 — Upload:** choose your file. CertForge reads the column headers and
   shows a preview.
4. **Step 2 — Map columns:** match each spreadsheet column to a certificate
   field. The recipient name is required; CertForge suggests sensible matches.
   Then choose the **template, course, and trainer** for the whole batch.
5. **Step 3 — Generate:** CertForge creates every certificate and gives you a
   **ZIP** download containing all the PDFs plus a `results.csv` that lists each
   certificate number (and any rows that failed).

> A single bad row never stops the batch — it's reported in `results.csv` while
> everything else still generates. Very large imports are capped (around 2000
> rows) and run while you wait.

---

## 9. Certificate history

**Certificate History** lists everything you've issued, newest first.

- **Search** by recipient name or certificate number.
- **Download / reprint** any certificate (the original PDF is stored, so
  reprints look identical even if you edit the template later).
- **Email** it.
- **Revoke / Restore** — revoking keeps the record but makes the public
  verification page show "Certificate revoked". Restore reverses that.
- **Delete** — permanently removes the certificate and its PDF. (Different from
  revoke: delete leaves no record.)

---

## 10. How verification works

Every certificate has a **unique number** and a **QR code**. Anyone — an
employer, a registrar — can scan the QR (or open the verification link) to see a
public page that confirms:

- whether the certificate is **valid** (or has been revoked),
- the **recipient name**, **course**, **issue date**, and **who issued it**.

Each certificate also carries a **content-integrity signature** — a unique
fingerprint (SHA-256) calculated from the PDF when it was issued and shown on the
verification page. If someone has the PDF, they can confirm it matches the
fingerprint, proving the document hasn't been altered since issue.

> Plain-language note: this fingerprint proves the file wasn't tampered with. It
> is **not** the kind of digital signature that makes a PDF reader show a green
> "trusted" badge — that's a separate, more advanced feature on the roadmap.

---

## 11. The activity log

**Activity Log** is a running record of everything that happens in your
organisation — certificates issued, emailed, revoked or deleted; templates,
courses, trainers and trainees created or changed; and settings updates. Use the
filter chips (Certificates, Templates, Courses, and so on) to narrow it down, and
**Load more** to go further back. It's read-only — a transparent audit trail.

---

## 12. Settings

**Settings** (owner/admin) controls organisation-wide options:

- **Organisation name** — the default "Issued by" shown on verification pages.
- **Default logo** — upload one logo (PNG/JPEG) that automatically appears on
  every template that has a **Logo** field but no logo of its own. A single
  template can still override it with its own logo.
- **Custom fonts** — upload a `.ttf` or `.otf` font and give it a name. That name
  then appears in the **Font** dropdown in the designer, so your certificates can
  use your brand typeface. If a font is ever missing, CertForge quietly falls
  back to a standard font rather than failing.

---

## 13. Roles

What you can do depends on your role:

| Role | Can do |
|------|--------|
| **Viewer** | See everything (read-only). Cannot generate certificates or change settings. |
| **Editor** | Everything a viewer can, plus create templates/courses/trainers/trainees, generate certificates, upload fonts. |
| **Admin** | Everything an editor can, plus change organisation settings, the default logo, and roles. |
| **Owner** | Full control of the organisation. |

If a button seems missing or you get a "forbidden" message, you likely need a
higher role — ask an administrator.

---

## 14. FAQ

**Do I need design software?**
No. Upload any PDF design, or generate one with the built-in AI helper.

**The preview looks right — will the PDF match?**
Yes. The live preview uses the same engine as the final certificate, so what you
place is what prints.

**Can I change a template after issuing certificates?**
Yes, but already-issued certificates keep their original look — each stored PDF
is preserved for faithful reprints. (You can't *delete* a template that has
certificates; **archive** it instead to hide it.)

**A field shows up empty on the certificate.**
The field's "field key" probably doesn't match a value being supplied. For the
QR code, the key must be `qr_code`; for a logo, `logo`. AI-generated templates
set these correctly for you.

**Email isn't sending.**
Email delivery must be configured by your administrator (an email provider key).
Until then, you'll see a clear "email not configured" message and nothing is
sent — generation and download are unaffected.

**The QR code points to "localhost".**
That's a setup detail for your administrator (the app's public address must be
configured for production). Ask them to set it.

**I can't see any data after signing up.**
A new account isn't linked to an organisation yet. Ask an administrator to add
you (it's a one-time step).
