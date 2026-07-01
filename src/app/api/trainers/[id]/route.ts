// PATCH  /api/trainers/[id] — update a trainer's name, title, institution.
// DELETE /api/trainers/[id] — delete a trainer and their signature file.
//   Certificates keep history via snapshot; the trainer_id reference is nulled.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
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

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  institution: z.string().optional(),
});

export async function PATCH(
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
    const body = patchSchema.parse(await req.json());
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.title !== undefined) patch.title = body.title ? body.title : null;
    if (body.institution !== undefined)
      patch.institution = body.institution ? body.institution : null;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const { data, error } = await db
      .from("trainers")
      .update(patch)
      .eq("id", params.id)
      .select("id, name, title, institution")
      .single();
    if (error || !data) throw new Error(error?.message ?? "update failed");

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "trainer.update",
      entity: "trainer",
      entity_id: params.id,
      metadata: patch,
    });
    return NextResponse.json({ trainer: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
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
