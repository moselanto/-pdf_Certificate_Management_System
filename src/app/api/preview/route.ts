// POST /api/preview
// Renders a certificate PDF from the CURRENT (unsaved) editor layout + sample
// values, without persisting anything. Powers the "Live preview" button.

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

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const db = createSupabaseServerClient();

    const { data: template, error } = await db
      .from("templates")
      .select("front_pdf_path, back_pdf_path")
      .eq("id", body.templateId)
      .single();
    if (error || !template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }

    const frontPdf = await downloadTemplate(db, template.front_pdf_path);
    const backPdf = template.back_pdf_path
      ? await downloadTemplate(db, template.back_pdf_path)
      : undefined;

    const qrBytes = await qrPng(verificationUrl("CF-2026-PREVIEW", "preview"));

    const pdfBytes = await renderCertificate({
      frontPdf,
      backPdf,
      placeholders: body.placeholders.map((p) => ({
        ...p,
        id: p.id ?? Math.random().toString(36),
      })),
      values: body.values,
      images: { qr_code: qrBytes },
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
