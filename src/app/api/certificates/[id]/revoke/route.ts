// POST /api/certificates/[id]/revoke — revoke (or un-revoke) a certificate.
// Body (optional): { "revoke": boolean } — defaults to true. Revoking keeps the
// record but flips status to "revoked" so the public verification page shows
// "Certificate revoked" instead of a valid result. Passing { revoke: false }
// restores it to "generated". This is the safe alternative to hard delete.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

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

const bodySchema = z
  .object({ revoke: z.boolean().optional() })
  .optional()
  .default({});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw);
    const revoke = body?.revoke ?? true;
    const nextStatus = revoke ? "revoked" : "generated";

    const { data: cert } = await db
      .from("certificates")
      .select("id, certificate_number, recipient_name, status")
      .eq("id", params.id)
      .single();
    if (!cert) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { data, error } = await db
      .from("certificates")
      .update({ status: nextStatus })
      .eq("id", params.id)
      .select("id, status")
      .single();
    if (error || !data) throw new Error(error?.message ?? "update failed");

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: revoke ? "certificate.revoke" : "certificate.unrevoke",
      entity: "certificate",
      entity_id: params.id,
      metadata: {
        certificateNumber: cert.certificate_number,
        recipientName: cert.recipient_name,
        from: cert.status,
        to: nextStatus,
      },
    });

    return NextResponse.json({ id: data.id, status: data.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
