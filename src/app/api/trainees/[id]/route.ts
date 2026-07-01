// PATCH  /api/trainees/[id]  — update a trainee's name/email
// DELETE /api/trainees/[id]  — delete a trainee. Blocked if the trainee already
//                              has issued certificates (preserves history).

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

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
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
    if (body.email !== undefined) patch.email = body.email ? body.email : null;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const { data, error } = await db
      .from("trainees")
      .update(patch)
      .eq("id", params.id)
      .select("id, name, email")
      .single();
    if (error || !data) throw new Error(error?.message ?? "update failed");

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "trainee.update",
      entity: "trainee",
      entity_id: params.id,
      metadata: patch,
    });
    return NextResponse.json({ trainee: data });
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

  // Load (RLS scopes to org) so we can name it in the audit log.
  const { data: trainee } = await db
    .from("trainees")
    .select("id, name")
    .eq("id", params.id)
    .single();
  if (!trainee) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Guard: don't delete a trainee with issued certificates (keeps history).
  const { count } = await db
    .from("certificates")
    .select("*", { count: "exact", head: true })
    .eq("trainee_id", params.id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This trainee has issued certificates and can't be deleted (history is preserved).",
      },
      { status: 409 },
    );
  }

  const { error: delErr } = await db.from("trainees").delete().eq("id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "trainee.delete",
    entity: "trainee",
    entity_id: params.id,
    metadata: { name: trainee.name },
  });

  return NextResponse.json({ deleted: true });
}
