// GET   /api/settings — return the org name + account info for the user.
// PATCH /api/settings — update the organisation name (used as the default
//   "Issued by" on verification pages). Admin/owner only.

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
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    orgId: profile.org_id,
    role: profile.role as string,
  };
}

export async function GET() {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", ctx.orgId)
    .single();

  return NextResponse.json({
    orgName: org?.name ?? "",
    email: ctx.email,
    role: ctx.role,
  });
}

const patchSchema = z.object({
  orgName: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change organisation settings." },
      { status: 403 },
    );
  }

  try {
    const body = patchSchema.parse(await req.json());
    const { error } = await db
      .from("organizations")
      .update({ name: body.orgName })
      .eq("id", ctx.orgId);
    if (error) throw new Error(error.message);

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "org.update",
      entity: "organization",
      entity_id: ctx.orgId,
      metadata: { name: body.orgName },
    });

    return NextResponse.json({ orgName: body.orgName });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
