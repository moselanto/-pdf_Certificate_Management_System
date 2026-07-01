// ============================================================================
// sendCertificateEmail — deliver a generated certificate PDF to a recipient.
//
// Resolves the certificate + its stored PDF + org/course/trainee context,
// builds the email, sends it (attaching the PDF), then flips the certificate
// status to "emailed" and writes an audit entry.
//
// Reusable from the single-cert email route and a future bulk-email action.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { certificateEmail } from "@/lib/email/templates";
import { verificationUrl } from "@/lib/qr/qr";
import { downloadBytes, CERT_BUCKET } from "@/lib/supabase/storage";

export interface SendCertificateEmailArgs {
  orgId: string;
  certificateId: string;
  /** Optional override; otherwise we use the linked trainee's email. */
  toEmail?: string;
  actorId?: string;
}

export interface SendCertificateEmailResult {
  to: string;
  providerId?: string;
}

export async function sendCertificateEmail(
  db: SupabaseClient,
  args: SendCertificateEmailArgs,
): Promise<SendCertificateEmailResult> {
  if (!emailConfigured()) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY and CERT_EMAIL_FROM.",
    );
  }

  // 1. Load the certificate (RLS scopes to the org).
  const { data: cert, error } = await db
    .from("certificates")
    .select(
      "id, certificate_number, recipient_name, pdf_path, verification_token, org_id, course_id, trainee_id, status",
    )
    .eq("id", args.certificateId)
    .single();
  if (error || !cert) throw new Error(`certificate not found: ${error?.message}`);
  if (!cert.pdf_path) throw new Error("certificate has no stored PDF to attach");
  if (cert.status === "revoked") throw new Error("certificate is revoked");

  // 2. Resolve the recipient email.
  let to = args.toEmail?.trim();
  if (!to && cert.trainee_id) {
    const { data: trainee } = await db
      .from("trainees")
      .select("email")
      .eq("id", cert.trainee_id)
      .single();
    to = trainee?.email ?? undefined;
  }
  if (!to) {
    throw new Error(
      "no recipient email — pass an email or link a trainee with an email address",
    );
  }

  // 3. Context for the body.
  const [{ data: org }, course] = await Promise.all([
    db.from("organizations").select("name").eq("id", cert.org_id).single(),
    cert.course_id
      ? db.from("courses").select("title").eq("id", cert.course_id).single()
      : Promise.resolve({ data: null as { title: string } | null }),
  ]);

  // 4. Fetch the stored PDF to attach.
  const pdfBytes = await downloadBytes(db, CERT_BUCKET, cert.pdf_path);

  // 5. Build + send.
  const { subject, html, text } = certificateEmail({
    recipientName: cert.recipient_name,
    certificateNumber: cert.certificate_number,
    organizationName: org?.name ?? null,
    courseTitle: course.data?.title ?? null,
    verificationUrl: verificationUrl(cert.certificate_number, cert.verification_token),
  });

  const result = await sendEmail({
    to,
    subject,
    html,
    text,
    attachments: [
      {
        filename: `${cert.certificate_number}.pdf`,
        content: pdfBytes,
        contentType: "application/pdf",
      },
    ],
  });

  // 6. Mark emailed + audit.
  await db.from("certificates").update({ status: "emailed" }).eq("id", cert.id);
  await db.from("audit_logs").insert({
    org_id: args.orgId,
    actor_id: args.actorId ?? null,
    action: "certificate.email",
    entity: "certificate",
    entity_id: cert.id,
    metadata: { to, provider_id: result.id ?? null },
  });

  return { to, providerId: result.id };
}
