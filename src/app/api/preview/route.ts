// POST /api/preview
// Renders a certificate PDF from the CURRENT (unsaved) editor layout + sample
// values, without persisting anything. Powers the "Live preview" button.
//
// If the layout includes a course-list box (or the template has a back page),
// we inject SAMPLE course units so the back page renders in the preview the
// same way it will at generation time.
//
// The template's uploaded logo is also injected (keyed "logo") so a placed Logo
// field previews exactly as it will on the generated certificate.

import { NextRequest, NextResponse } from "next/server";
import { renderCertificate } from "@/lib/pdf/overlay";
import { qrPng, verificationUrl } from "@/lib/qr/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { downloadTemplate } from "@/lib/supabase/storage";
import { placeholderSchema } from "@/lib/domain/schemas";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  templateId: z.string().uuid(),
  placeholders: z.array(placeholderSchema),
  values: z.record(z.string()).default({}),
});

const SAMPLE_UNITS = [
  "Use of full body hoist",
  "Use of stand aids",
  "Use of a slide sheet",
  "Use of turn-table and handling belt",
  "Managing of safe transfer",
].map((title, i) => ({ id: `sample_${i}`, sortOrder: i, title }));

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const db = createSupabaseServerClient();

    const { data: template, error } = await db
      .from("templates")
      .select(
        "front_pdf_path, back_pdf_path, logo_path, is_from_scratch, design_elements, blank_page_size",
      )
      .eq("id", body.templateId)
      .single();
    if (error || !template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }

    // FROM-SCRATCH templates have no PDF: render a blank page + design elements.
    const isFromScratch = Boolean(template.is_from_scratch) || !template.front_pdf_path;
    const frontPdf = isFromScratch
      ? undefined
      : await downloadTemplate(db, template.front_pdf_path);
    const backPdf =
      !isFromScratch && template.back_pdf_path
        ? await downloadTemplate(db, template.back_pdf_path)
        : undefined;
    const designElements =
      isFromScratch && Array.isArray(template.design_elements)
        ? template.design_elements
        : undefined;
    const blankPage =
      isFromScratch && template.blank_page_size ? template.blank_page_size : undefined;

    // Render the QR using the QR placeholder's configured colors so the preview
    // reflects custom QR appearance (e.g. white-on-transparent for dark themes).
    const qrPh = body.placeholders.find((p) => p.kind === "qr");
    const qrBytes = await qrPng(verificationUrl("CF-2026-PREVIEW", "preview"), {
      dark: qrPh?.qrDark,
      light: qrPh?.qrTransparent ? "#00000000" : qrPh?.qrLight,
    });

    const images: Record<string, Uint8Array> = { qr_code: qrBytes };

    // Template logo: inject it so a placed "logo" field previews the same way
    // it renders on the generated certificate (matches generateCertificate).
    if (template.logo_path) {
      try {
        images.logo = await downloadTemplate(db, template.logo_path);
      } catch {
        /* logo optional — ignore if it can't be fetched */
      }
    }

    // Show sample units so the back page (course list box or auto back page)
    // is visible in the preview. Only inject when there's somewhere to draw
    // them: a course-list box, or an uploaded back page.
    const hasCourseList = body.placeholders.some(
      (p) => p.kind === "course_list" || p.fieldKey === "course_units",
    );
    const units = hasCourseList || backPdf ? SAMPLE_UNITS : undefined;

    const pdfBytes = await renderCertificate({
      frontPdf,
      backPdf,
      blankPage,
      designElements,
      placeholders: body.placeholders.map((p) => ({
        ...p,
        id: p.id ?? Math.random().toString(36),
      })),
      values: body.values,
      images,
      units,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
