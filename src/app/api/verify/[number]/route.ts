// GET /api/verify/[number]?t=token
// PUBLIC endpoint (no auth) used by the verification page. Uses the
// service-role client to bypass RLS, but returns ONLY non-sensitive fields
// and requires the per-certificate verification token to match.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Final fallback issuer if neither the trainer's institution nor the
// organisation name is set. Override with CERT_ISSUER_NAME.
const DEFAULT_ISSUER =
  process.env.CERT_ISSUER_NAME ?? "Pimofy Training Institute";

export async function GET(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  const token = req.nextUrl.searchParams.get("t");
  const db = createSupabaseServiceClient();

  const { data: cert } = await db
    .from("certificates")
    .select(
      "certificate_number, recipient_name, issue_date, status, verification_token, org_id, course_id, template_id, trainer_id",
    )
    .eq("certificate_number", params.number)
    .single();

  if (!cert || (token && cert.verification_token !== token)) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }
  if (token && cert.verification_token !== token) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  // Enrich with the trainer's institution (preferred "Issued by"), the org
  // name (fallback), and the course name for a trustworthy display.
  const [{ data: trainer }, { data: org }, { data: course }] = await Promise.all([
    cert.trainer_id
      ? db.from("trainers").select("institution").eq("id", cert.trainer_id).single()
      : Promise.resolve({ data: null }),
    db.from("organizations").select("name").eq("id", cert.org_id).single(),
    cert.course_id
      ? db.from("courses").select("title").eq("id", cert.course_id).single()
      : Promise.resolve({ data: null }),
  ]);

  // "Issued by" priority: the signing trainer's institution → org name →
  // configured default. This way the certificate reflects the institution the
  // trainer belongs to, as requested.
  const issuedBy =
    trainer?.institution?.trim() || org?.name?.trim() || DEFAULT_ISSUER;

  return NextResponse.json({
    valid: cert.status !== "revoked",
    revoked: cert.status === "revoked",
    certificateNumber: cert.certificate_number,
    recipientName: cert.recipient_name,
    issueDate: cert.issue_date,
    organization: issuedBy,
    course: course?.title ?? null,
  });
}
