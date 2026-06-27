// ============================================================================
// Email sending — provider-agnostic with a Resend default implementation.
//
// The rest of the app depends only on the `sendEmail` interface, so swapping
// providers (SendGrid, SES, Postmark) is a one-file change. Resend is the
// default because it has a clean attachment API and a generous free tier.
//
// Configure via env:
//   RESEND_API_KEY      — API key (if unset, sending is disabled with a clear error)
//   CERT_EMAIL_FROM     — From header, e.g. "CertForge <certs@yourdomain.com>"
// ============================================================================

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  id?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.CERT_EMAIL_FROM);
}

/** Send an email via Resend's REST API (no SDK dependency needed). */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CERT_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY and CERT_EMAIL_FROM in your environment.",
    );
  }

  const body = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      // Resend expects base64-encoded content for raw attachments.
      content: Buffer.from(a.content).toString("base64"),
      content_type: a.contentType ?? "application/octet-stream",
    })),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`email provider error (${res.status}): ${detail}`);
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: json.id };
}
