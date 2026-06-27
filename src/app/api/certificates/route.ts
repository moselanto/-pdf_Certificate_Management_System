// POST /api/certificates — generate & persist a single certificate.
// GET  /api/certificates — list certificate history for the user's org.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateCertificate } from "@/lib/services/generateCertificate";
import { generateCertificateSchema } from "@/lib/domain/schemas";

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

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const input = generateCertificateSchema.parse(await req.json());
    const result = await generateCertificate(db, {
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      templateId: input.templateId,
      recipientName: input.recipientName,
      issueDate: input.issueDate,
      courseId: input.courseId,
      trainerId: input.trainerId,
      traineeId: input.traineeId,
      values: input.values,
    });
    return NextResponse.json({
      id: result.certificateId,
      certificateNumber: result.certificateNumber,
      pdfPath: result.pdfPath,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  let query = db
    .from("certificates")
    .select("id, certificate_number, recipient_name, issue_date, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(
      `recipient_name.ilike.%${q}%,certificate_number.ilike.%${q}%`,
    );
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ certificates: data });
}
