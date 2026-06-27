// Email body templates for certificate delivery. Plain, professional, and
// safe (values are escaped). Returns both HTML and a text fallback.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CertificateEmailParams {
  recipientName: string;
  certificateNumber: string;
  organizationName?: string | null;
  courseTitle?: string | null;
  verificationUrl: string;
}

export function certificateEmail(p: CertificateEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const org = p.organizationName ? esc(p.organizationName) : "your training provider";
  const course = p.courseTitle ? ` for <strong>${esc(p.courseTitle)}</strong>` : "";
  const courseText = p.courseTitle ? ` for ${p.courseTitle}` : "";

  const subject = `Your certificate (${p.certificateNumber})`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="color:#1d4ed8;margin-bottom:4px">Congratulations, ${esc(p.recipientName)}</h2>
    <p style="font-size:14px;line-height:1.6">
      Please find your certificate${course} attached as a PDF, issued by ${org}.
    </p>
    <p style="font-size:14px;line-height:1.6">
      Certificate number: <strong>${esc(p.certificateNumber)}</strong>
    </p>
    <p style="font-size:14px;line-height:1.6">
      Anyone can confirm this certificate is authentic here:<br/>
      <a href="${esc(p.verificationUrl)}" style="color:#1d4ed8">${esc(p.verificationUrl)}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
    <p style="font-size:12px;color:#64748b">This email was sent by CertForge on behalf of ${org}.</p>
  </div>`.trim();

  const text = [
    `Congratulations, ${p.recipientName}`,
    ``,
    `Please find your certificate${courseText} attached as a PDF, issued by ${p.organizationName ?? "your training provider"}.`,
    `Certificate number: ${p.certificateNumber}`,
    ``,
    `Verify authenticity: ${p.verificationUrl}`,
  ].join("\n");

  return { subject, html, text };
}
