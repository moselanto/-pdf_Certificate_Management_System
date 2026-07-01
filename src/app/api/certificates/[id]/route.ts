// GET    /api/certificates/[id] — single certificate (basic fields)
// DELETE /api/certificates/[id] — permanently delete a certificate: removes the
//   stored PDF (best-effort) and the DB row, and writes an audit log entry.
//   This is a hard delete from history — distinct from "revoke", which keeps
//   the record but marks it invalid on the verification page.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CERT_BUCKET } from "@/lib/supabase/storage";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: cert, error } = await db
    .from("certificates")
    .select("id, certificate_number, recipient_name, issue_date, status, created_at")
    .eq("id", params.id)
    .single();
  if (error || !cert) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ certificate: cert });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Load the certificate (RLS scopes to the org) so we know its PDF path.
  const { data: cert } = await db
    .from("certificates")
    .select("id, certificate_number, recipient_name, pdf_path")
    .eq("id", params.id)
    .single();
  if (!cert) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Remove the stored PDF (best-effort — don't block the delete if it's gone).
  if (cert.pdf_path) {
    await db.storage.from(CERT_BUCKET).remove([cert.pdf_path]).catch(() => {});
  }

  const { error: delErr } = await db.from("certificates").delete().eq("id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "certificate.delete",
    entity: "certificate",
    entity_id: params.id,
    metadata: {
      certificateNumber: cert.certificate_number,
      recipientName: cert.recipient_name,
    },
  });

  return NextResponse.json({ deleted: true });
}
