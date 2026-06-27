// GET /api/verify/[number]?t=token
// PUBLIC endpoint (no auth) used by the verification page. Uses the
// service-role client to bypass RLS, but returns ONLY non-sensitive fields
// and requires the per-certificate verification token to match.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  const token = req.nextUrl.searchParams.get("t");
  const db = createSupabaseServiceClient();

  const { data: cert } = await db
    .from("certificates")
    .select(
      "certificate_number, recipient_name, issue_date, status, verification_token, org_id, course_id, template_id",
    )
    .eq("certificate_number", params.number)
    .single();

  if (!cert || (token && cert.verification_token !== token)) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }
  if (token && cert.verification_token !== token) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  // Enrich with org + course name for a trustworthy display.
  const [{ data: org }, { data: course }] = await Promise.all([
    db.from("organizations").select("name").eq("id", cert.org_id).single(),
    cert.course_id
      ? db.from("courses").select("title").eq("id", cert.course_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    valid: cert.status !== "revoked",
    revoked: cert.status === "revoked",
    certificateNumber: cert.certificate_number,
    recipientName: cert.recipient_name,
    issueDate: cert.issue_date,
    organization: org?.name ?? null,
    course: course?.title ?? null,
  });
}
