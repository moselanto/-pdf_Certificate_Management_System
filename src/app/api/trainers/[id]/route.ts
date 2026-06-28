// DELETE /api/trainers/[id] — delete a trainer and their signature file.
// Allowed even if certificates reference the trainer (we null the reference is
// not needed — certificates store a field_values snapshot, so history stays
// intact). We simply block nothing here but keep the audit trail.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";

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

  const { data: trainer } = await db
    .from("trainers")
    .select("id, name, signature_path")
    .eq("id", params.id)
    .single();
  if (!trainer) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Null the trainer reference on any certificates (history kept via snapshot).
  await db.from("certificates").update({ trainer_id: null }).eq("trainer_id", params.id);

  if (trainer.signature_path) {
    await db.storage.from(TEMPLATE_BUCKET).remove([trainer.signature_path]).catch(() => {});
  }
  const { error: delErr } = await db.from("trainers").delete().eq("id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "trainer.delete",
    entity: "trainer",
    entity_id: params.id,
    metadata: { name: trainer.name },
  });

  return NextResponse.json({ deleted: true });
}
