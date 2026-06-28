// ============================================================================
// generateCertificate — the orchestration service that ties the engine to the
// database & storage. Reusable from both the single-generation API route and
// the (future) bulk-import worker.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { renderCertificate } from "@/lib/pdf/overlay";
import { qrPng, verificationUrl } from "@/lib/qr/qr";
import { generateCertificateNumber } from "@/lib/pdf/certificateNumber";
import { downloadTemplate, uploadCertificate } from "@/lib/supabase/storage";
import type { Placeholder, CourseUnit } from "@/lib/domain/types";

export interface GenerateArgs {
  orgId: string;
  templateId: string;
  recipientName: string;
  issueDate: string; // ISO
  courseId?: string;
  trainerId?: string;
  traineeId?: string;
  /** Extra field values keyed by fieldKey (override/augment defaults). */
  values?: Record<string, string>;
  createdBy?: string;
}

export interface GenerateResult {
  certificateId: string;
  certificateNumber: string;
  pdfPath: string;
  pdfBytes: Uint8Array;
}

/**
 * Generate one certificate: resolve template + placeholders + course units,
 * render the PDF (with QR), persist it, and write the certificate + audit row.
 */
export async function generateCertificate(
  db: SupabaseClient,
  args: GenerateArgs,
): Promise<GenerateResult> {
  // 1. Load template + placeholders
  const { data: template, error: tErr } = await db
    .from("templates")
    .select("id, front_pdf_path, back_pdf_path, logo_path")
    .eq("id", args.templateId)
    .single();
  if (tErr || !template) throw new Error(`template not found: ${tErr?.message}`);

  const { data: phRows } = await db
    .from("placeholders")
    .select("*")
    .eq("template_id", args.templateId);
  const placeholders: Placeholder[] = (phRows ?? []).map(mapPlaceholder);

  // 2. Resolve course units (back page)
  let units: CourseUnit[] = [];
  if (args.courseId) {
    const { data: unitRows } = await db
      .from("course_units")
      .select("id, sort_order, title")
      .eq("course_id", args.courseId)
      .order("sort_order");
    units = (unitRows ?? []).map((u) => ({
      id: u.id,
      sortOrder: u.sort_order,
      title: u.title,
    }));
  }

  // 3. Resolve trainer name / signature if requested
  let trainerName: string | undefined;
  let signatureBytes: Uint8Array | undefined;
  if (args.trainerId) {
    const { data: trainer } = await db
      .from("trainers")
      .select("name, signature_path")
      .eq("id", args.trainerId)
      .single();
    trainerName = trainer?.name;
    if (trainer?.signature_path) {
      try {
        signatureBytes = await downloadTemplate(db, trainer.signature_path);
      } catch {
        /* signature optional — ignore */
      }
    }
  }

  // 4. Allocate certificate number + verification token, build the QR using
  //    the QR placeholder's configured colors (if any).
  const certificateNumber = generateCertificateNumber();
  const token = cryptoRandomHex(16);
  const qrPh = placeholders.find((p) => p.kind === "qr");
  const qrBytes = await qrPng(verificationUrl(certificateNumber, token), {
    dark: qrPh?.qrDark,
    light: qrPh?.qrTransparent ? "#00000000" : qrPh?.qrLight,
  });

  // 5. Assemble field values
  const values: Record<string, string> = {
    recipient_name: args.recipientName,
    issue_date: new Date(args.issueDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    certificate_number: certificateNumber,
    ...(trainerName ? { trainer_name: trainerName, trainer_signature: trainerName } : {}),
    ...args.values,
  };

  const images: Record<string, Uint8Array> = { qr_code: qrBytes };
  if (signatureBytes) images.trainer_signature = signatureBytes;

  // Template logo: if the template has an uploaded logo AND the designer placed
  // a "logo" image placeholder, draw the logo into that box on every cert.
  // Keyed "logo" to match the placeholder's fieldKey.
  if (template.logo_path) {
    try {
      images.logo = await downloadTemplate(db, template.logo_path);
    } catch {
      /* logo optional — ignore if it can't be fetched */
    }
  }

  // 6. Render
  const frontPdf = await downloadTemplate(db, template.front_pdf_path);
  const backPdf = template.back_pdf_path
    ? await downloadTemplate(db, template.back_pdf_path)
    : undefined;

  const pdfBytes = await renderCertificate({
    frontPdf,
    backPdf,
    placeholders,
    values,
    images,
    units,
    unitsLayout: { x: 72, y: 220, fontSize: 12, lineGap: 8 },
  });

  // 7. Persist PDF + DB row
  const pdfPath = await uploadCertificate(db, certificateNumber, pdfBytes);

  const { data: cert, error: cErr } = await db
    .from("certificates")
    .insert({
      org_id: args.orgId,
      certificate_number: certificateNumber,
      template_id: args.templateId,
      course_id: args.courseId ?? null,
      trainer_id: args.trainerId ?? null,
      trainee_id: args.traineeId ?? null,
      recipient_name: args.recipientName,
      issue_date: args.issueDate,
      field_values: values,
      pdf_path: pdfPath,
      verification_token: token,
      created_by: args.createdBy ?? null,
    })
    .select("id")
    .single();
  if (cErr || !cert) throw new Error(`persist failed: ${cErr?.message}`);

  // 8. Audit
  await db.from("audit_logs").insert({
    org_id: args.orgId,
    actor_id: args.createdBy ?? null,
    action: "certificate.generate",
    entity: "certificate",
    entity_id: cert.id,
    metadata: { certificate_number: certificateNumber },
  });

  return { certificateId: cert.id, certificateNumber, pdfPath, pdfBytes };
}

function cryptoRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function mapPlaceholder(r: Record<string, unknown>): Placeholder {
  return {
    id: String(r.id),
    page: r.page as Placeholder["page"],
    kind: r.kind as Placeholder["kind"],
    fieldKey: String(r.field_key),
    label: String(r.label),
    x: Number(r.x),
    y: Number(r.y),
    width: r.width == null ? undefined : Number(r.width),
    height: r.height == null ? undefined : Number(r.height),
    fontSize: Number(r.font_size),
    fontFamily: String(r.font_family),
    color: String(r.color),
    align: r.align as Placeholder["align"],
    qrDark: r.qr_dark == null ? undefined : String(r.qr_dark),
    qrLight: r.qr_light == null ? undefined : String(r.qr_light),
    qrTransparent: r.qr_transparent == null ? undefined : Boolean(r.qr_transparent),
  };
}
