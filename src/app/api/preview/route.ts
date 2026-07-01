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
import { promises as fs } from "fs";
import path from "path";
import { renderCertificate } from "@/lib/pdf/overlay";
import { qrPng, verificationUrl } from "@/lib/qr/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { downloadTemplate } from "@/lib/supabase/storage";
import { placeholderSchema } from "@/lib/domain/schemas";
import { loadBundledFonts } from "@/lib/fonts/bundledFontsServer";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  templateId: z.string().uuid(),
  placeholders: z.array(placeholderSchema),
  values: z.record(z.string()).default({}),
  // Optional trainer to preview with. When set and that trainer has an
  // uploaded signature, the preview injects their REAL signature image so a
  // Trainer Signature field previews exactly as it will print. When omitted (or
  // the trainer has no signature on file), we inject a bundled SAMPLE signature
  // image instead so the field still previews as an image, not typed text.
  trainerId: z.string().uuid().optional(),
});

/** Load the bundled sample signature PNG shipped in public/samples. */
async function loadSampleSignature(): Promise<Uint8Array | undefined> {
  try {
    const buf = await fs.readFile(
      path.join(process.cwd(), "public", "samples", "sample-signature.png"),
    );
    return new Uint8Array(buf);
  } catch {
    return undefined;
  }
}

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
        "front_pdf_path, back_pdf_path, logo_path, is_from_scratch, design_elements, blank_page_size, certificate_title",
      )
      .eq("id", body.templateId)
      .single();
    if (error || !template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }

    // FROM-SCRATCH templates have no PDF: render a blank page. PDF templates
    // download the PDF backdrop. In BOTH cases we draw design elements
    // (text/line/rect) on top — so drawn artwork works on uploaded PDFs too,
    // not only from-scratch templates.
    const isFromScratch = Boolean(template.is_from_scratch) || !template.front_pdf_path;
    const frontPdf = isFromScratch
      ? undefined
      : await downloadTemplate(db, template.front_pdf_path);
    const backPdf =
      !isFromScratch && template.back_pdf_path
        ? await downloadTemplate(db, template.back_pdf_path)
        : undefined;
    // Draw saved design elements regardless of template type.
    const designElements = Array.isArray(template.design_elements)
      ? template.design_elements
      : undefined;
    // Blank page size only applies to from-scratch (no PDF) templates.
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

    // Signature fields: preview as an IMAGE, matching a real certificate.
    // A signature placeholder renders the uploaded image when image bytes are
    // present, and only falls back to typed text when none exist. So for the
    // preview to look right we must inject a signature image for each signature
    // field. Resolution per field:
    //   1. If a trainer is selected (body.trainerId) and has a signature on
    //      file, use their REAL uploaded signature.
    //   2. Otherwise inject the bundled SAMPLE signature so the box still
    //      previews as an image (not typed text).
    const sigFields = body.placeholders.filter(
      (p) => p.kind === "signature" && p.fieldKey !== "logo",
    );
    if (sigFields.length) {
      let trainerSig: Uint8Array | undefined;
      if (body.trainerId) {
        const { data: trainer } = await db
          .from("trainers")
          .select("signature_path")
          .eq("id", body.trainerId)
          .single();
        if (trainer?.signature_path) {
          try {
            trainerSig = await downloadTemplate(db, trainer.signature_path);
          } catch {
            /* fall back to the sample below */
          }
        }
      }
      const sampleSig = trainerSig ? undefined : await loadSampleSignature();
      const sig = trainerSig ?? sampleSig;
      if (sig) {
        for (const p of sigFields) {
          if (!images[p.fieldKey]) images[p.fieldKey] = sig;
        }
      }
    }

    // Show sample units so the back page (course list box or auto back page)
    // is visible in the preview. Only inject when there's somewhere to draw
    // them: a course-list box, or an uploaded back page.
    const hasCourseList = body.placeholders.some(
      (p) => p.kind === "course_list" || p.fieldKey === "course_units",
    );
    const units = hasCourseList || backPdf ? SAMPLE_UNITS : undefined;

    // Bundled free fonts are always available in the preview so drawn/dynamic
    // text renders in the chosen typeface without any upload. (Org-uploaded
    // custom fonts are resolved at generation time; the live preview uses the
    // bundled set + standard fonts.)
    const customFonts = await loadBundledFonts();

    // Prefill certificate_title from the template's saved column so the live
    // preview matches what will print. The editor's own values still win: if
    // the user typed a certificate_title sample, body.values overrides this.
    const previewValues: Record<string, string> = {
      ...(template.certificate_title
        ? { certificate_title: String(template.certificate_title) }
        : {}),
      ...body.values,
    };

    const pdfBytes = await renderCertificate({
      frontPdf,
      backPdf,
      blankPage,
      designElements,
      placeholders: body.placeholders.map((p) => ({
        ...p,
        id: p.id ?? Math.random().toString(36),
      })),
      values: previewValues,
      images,
      units,
      customFonts,
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
