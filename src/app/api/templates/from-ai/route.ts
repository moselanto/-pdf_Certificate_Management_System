// POST /api/templates/from-ai
// Create a real, usable template from an offline-generated certificate
// background — NO manual PDF upload, NO external API. We:
//   1. read the stored background PDF (rendered by the offline vector
//      generator in ai-suggest; it is ALREADY a single front-page PDF),
//   2. copy it in as the template front (re-rendering from the styleId when
//      available, so the front is always clean and the right page size),
//   3. (optionally) create a clean blank back page for the course-units list,
//   4. upload front/back PDFs to the templates bucket,
//   5. insert the template row, and
//   6. auto-place the standard placeholders (recipient name, course title,
//      date, certificate number, signature, institution, QR, + a back-page
//      course_list box) so the template is ready to generate immediately.
//
// Body: { imageStoragePath: string, name: string, styleId?: string,
//         orientation?: "landscape"|"portrait", includeBack?: boolean }
// Returns: { id, pageWidth, pageHeight }

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { downloadBytes, TEMPLATE_BUCKET } from "@/lib/supabase/storage";
import { buildBackgroundPdf, presetById, textColorsFor } from "@/lib/pdf/certBackground";
import type { Placeholder } from "@/lib/domain/types";
import { z } from "zod";

export const runtime = "nodejs";

async function currentContext(db: ReturnType<typeof createSupabaseServerClient>) {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("org_id, role")
    .eq("id", auth.user.id)
    .single();
  if (!profile) return null;
  return { userId: auth.user.id, orgId: profile.org_id, role: profile.role as string };
}

const bodySchema = z.object({
  imageStoragePath: z.string().min(1),
  name: z.string().min(1),
  styleId: z.string().optional(),
  orientation: z.enum(["landscape", "portrait"]).optional(),
  includeBack: z.boolean().optional(),
});

// A4-ish landscape/portrait in points (must match certBackground/ai-suggest).
const PAGE = {
  landscape: { w: 842, h: 595 },
  portrait: { w: 595, h: 842 },
};

/**
 * Produce the front-page PDF for the template.
 *
 * The offline generator already stored a single-page background PDF at
 * `storagePath`. We re-render the front from the known styleId when one is
 * provided (guarantees a clean, correctly-sized page even if the stored
 * preview was generated at a different size), and fall back to copying the
 * stored PDF bytes when the styleId is unknown.
 */
async function buildFrontPdf(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  storagePath: string,
  styleId: string | undefined,
  pageW: number,
  pageH: number,
): Promise<Uint8Array> {
  if (styleId && presetById(styleId).id === styleId) {
    return buildBackgroundPdf(styleId, pageW, pageH);
  }
  // Fallback: copy the stored background PDF as-is.
  return downloadBytes(svc, TEMPLATE_BUCKET, storagePath);
}

/** Build a blank back page (for the course-units list). */
async function blankPdf(pageW: number, pageH: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([pageW, pageH]);
  return pdf.save();
}

/**
 * Auto-placed default placeholders, positioned for a typical certificate.
 * Top-left origin, points. Centered fields use the page mid-x as the anchor.
 */
function defaultPlaceholders(
  pageW: number,
  pageH: number,
  includeBack: boolean,
  styleId: string | undefined,
): Placeholder[] {
  const cx = Math.round(pageW / 2);
  const id = (k: string) => `ai-${k}`;
  // Colors derived from the chosen background style so text always reads well
  // against it (headings borrow the style's primary; body/secondary use a
  // calibrated dark gray). Falls back to the first preset when styleId is unset.
  const colors = textColorsFor(styleId ?? "");
  const phs: Placeholder[] = [
    {
      id: id("recipient"),
      page: "front",
      kind: "text",
      fieldKey: "recipient_name",
      label: "Recipient name",
      x: cx,
      y: Math.round(pageH * 0.42),
      fontSize: 34,
      fontFamily: "Times-Bold",
      color: colors.heading,
      align: "center",
    },
    {
      id: id("course"),
      page: "front",
      kind: "text",
      fieldKey: "course_title",
      label: "Course / programme title",
      x: cx,
      y: Math.round(pageH * 0.56),
      fontSize: 20,
      fontFamily: "Helvetica",
      color: colors.body,
      align: "center",
    },
    {
      id: id("date"),
      page: "front",
      kind: "date",
      fieldKey: "issue_date",
      label: "Issue date",
      x: Math.round(pageW * 0.22),
      y: Math.round(pageH * 0.82),
      fontSize: 13,
      fontFamily: "Helvetica",
      color: colors.muted,
      align: "center",
    },
    {
      id: id("signature"),
      page: "front",
      kind: "signature",
      fieldKey: "trainer_signature",
      label: "Trainer signature",
      x: Math.round(pageW * 0.78),
      y: Math.round(pageH * 0.78),
      width: 150,
      height: 48,
      fontSize: 18,
      fontFamily: "Helvetica-Oblique",
      color: colors.body,
      align: "center",
    },
    {
      id: id("institution"),
      page: "front",
      kind: "text",
      fieldKey: "institution",
      label: "Issuing institution",
      x: cx,
      y: Math.round(pageH * 0.9),
      fontSize: 12,
      fontFamily: "Helvetica",
      color: colors.muted,
      align: "center",
    },
    {
      id: id("certno"),
      page: "front",
      kind: "text",
      fieldKey: "certificate_number",
      label: "Certificate number",
      x: Math.round(pageW * 0.08),
      y: Math.round(pageH * 0.94),
      fontSize: 9,
      fontFamily: "Courier",
      color: colors.muted,
      align: "left",
    },
    {
      // NOTE: fieldKey MUST be "qr_code" — the render engine
      // (generateCertificate) injects the verification QR into the image map
      // keyed "qr_code". The previous "verify_qr" key never matched, so the QR
      // box rendered empty on AI-generated templates.
      id: id("qr"),
      page: "front",
      kind: "qr",
      fieldKey: "qr_code",
      label: "Verification QR code",
      x: Math.round(pageW * 0.88),
      y: Math.round(pageH * 0.88),
      width: 72,
      height: 72,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#000000",
      align: "left",
      qrDark: colors.qrDark,
      qrTransparent: colors.qrTransparent,
    },
  ];

  if (includeBack) {
    phs.push({
      id: id("courselist"),
      page: "back",
      kind: "course_list",
      fieldKey: "course_units",
      label: "Units Covered",
      x: cx,
      y: Math.round(pageH * 0.22),
      width: Math.round(pageW * 0.7),
      fontSize: 16,
      fontFamily: "Helvetica",
      color: "#222222",
      align: "center",
    });
  }

  return phs;
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const input = bodySchema.parse(await req.json());
    const orientation = input.orientation ?? "landscape";
    const { w: pageW, h: pageH } = PAGE[orientation];

    // Guard: the stored path must live under this org's folder (the ai-suggest
    // route writes to `${orgId}/ai/...`). Prevents using another org's asset.
    if (!input.imageStoragePath.startsWith(`${ctx.orgId}/`)) {
      return NextResponse.json({ error: "invalid image reference" }, { status: 400 });
    }

    // Service client for RLS-free storage reads (the stored background lives
    // under the org's ai/ folder).
    const svc = createSupabaseServiceClient();

    // Build the front PDF: re-render from the known styleId when provided,
    // else copy the stored background PDF as-is.
    const frontPdf = await buildFrontPdf(
      svc,
      input.imageStoragePath,
      input.styleId,
      pageW,
      pageH,
    );

    const stamp = Date.now();
    const frontPath = `${ctx.orgId}/${stamp}-ai-front.pdf`;
    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(frontPath, frontPdf, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`front upload failed: ${upErr.message}`);

    let backPath: string | null = null;
    if (input.includeBack) {
      const backPdf = await blankPdf(pageW, pageH);
      backPath = `${ctx.orgId}/${stamp}-ai-back.pdf`;
      const { error: bErr } = await db.storage
        .from(TEMPLATE_BUCKET)
        .upload(backPath, backPdf, { contentType: "application/pdf", upsert: false });
      if (bErr) throw new Error(`back upload failed: ${bErr.message}`);
    }

    // Insert the template row.
    const { data: tpl, error: insErr } = await db
      .from("templates")
      .insert({
        org_id: ctx.orgId,
        name: input.name,
        front_pdf_path: frontPath,
        back_pdf_path: backPath,
        page_width: pageW,
        page_height: pageH,
      })
      .select("id")
      .single();
    if (insErr || !tpl) throw new Error(`create failed: ${insErr?.message}`);

    // Auto-place the standard placeholders (colors derived from the style).
    const placeholders = defaultPlaceholders(pageW, pageH, !!input.includeBack, input.styleId);
    // NOTE: the placeholders table has NO org_id column — rows are scoped via
    // their parent template_id (RLS enforces the org). Column names mirror the
    // designer's PUT /api/templates/[id]/placeholders insert exactly.
    const { error: phErr } = await db.from("placeholders").insert(
      placeholders.map((p) => ({
        template_id: tpl.id,
        page: p.page,
        kind: p.kind,
        field_key: p.fieldKey,
        label: p.label,
        x: p.x,
        y: p.y,
        width: p.width ?? null,
        height: p.height ?? null,
        font_size: p.fontSize,
        font_family: p.fontFamily,
        color: p.color,
        align: p.align,
        qr_dark: p.qrDark ?? null,
        qr_light: p.qrLight ?? null,
        qr_transparent: p.qrTransparent ?? false,
      })),
    );
    if (phErr) throw new Error(`placeholder seed failed: ${phErr.message}`);

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "template.create",
      entity: "template",
      entity_id: tpl.id,
      metadata: { name: input.name, source: "ai", orientation },
    });

    return NextResponse.json({ id: tpl.id, pageWidth: pageW, pageHeight: pageH });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
