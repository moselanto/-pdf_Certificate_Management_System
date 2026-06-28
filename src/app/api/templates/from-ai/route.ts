// POST /api/templates/from-ai
// Create a real, usable template from an AI-generated background image — NO
// manual PDF upload. We:
//   1. read the stored PNG background (from ai-suggest),
//   2. wrap it into a single front-page PDF sized to the image's aspect ratio
//      (landscape ~842x595, portrait ~595x842 points),
//   3. (optionally) create a clean blank back page for the course-units list,
//   4. upload front/back PDFs to the templates bucket,
//   5. insert the template row, and
//   6. auto-place the standard placeholders (recipient name, course title,
//      date, certificate number, signature, institution, QR, + a back-page
//      course_list box) so the template is ready to generate immediately.
//
// Body: { imageStoragePath: string, name: string, orientation?: "landscape"|
//         "portrait", includeBack?: boolean }
// Returns: { id, pageWidth, pageHeight }

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { downloadBytes, TEMPLATE_BUCKET } from "@/lib/supabase/storage";
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
  orientation: z.enum(["landscape", "portrait"]).optional(),
  includeBack: z.boolean().optional(),
});

// A4-ish landscape/portrait in points.
const PAGE = {
  landscape: { w: 842, h: 595 },
  portrait: { w: 595, h: 842 },
};

/** Wrap PNG bytes into a single-page PDF that fills the page edge-to-edge. */
async function imageToPdf(
  pngBytes: Uint8Array,
  pageW: number,
  pageH: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageW, pageH]);
  const img = await pdf.embedPng(pngBytes);
  // Fill the whole page (the background was generated at the right aspect
  // ratio, so a full-bleed draw avoids letterboxing).
  page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  return pdf.save();
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
): Placeholder[] {
  const cx = Math.round(pageW / 2);
  const id = (k: string) => `ai-${k}`;
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
      color: "#1A1A1A",
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
      color: "#333333",
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
      color: "#444444",
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
      color: "#222222",
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
      color: "#666666",
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
      color: "#888888",
      align: "left",
    },
    {
      id: id("qr"),
      page: "front",
      kind: "qr",
      fieldKey: "verify_qr",
      label: "Verification QR code",
      x: Math.round(pageW * 0.88),
      y: Math.round(pageH * 0.88),
      width: 72,
      height: 72,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#000000",
      align: "left",
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

    // Service client to read the stored PNG (RLS-free storage read).
    const svc = createSupabaseServiceClient();
    const pngBytes = await downloadBytes(svc, TEMPLATE_BUCKET, input.imageStoragePath);

    // Build front (image) + optional back (blank) PDFs.
    const frontPdf = await imageToPdf(pngBytes, pageW, pageH);

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

    // Auto-place the standard placeholders.
    const placeholders = defaultPlaceholders(pageW, pageH, !!input.includeBack);
    const { error: phErr } = await db.from("placeholders").insert(
      placeholders.map((p) => ({
        template_id: tpl.id,
        org_id: ctx.orgId,
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
