// GET  /api/trainers  — list trainers for the user's org
// POST /api/trainers  — create a trainer (signature upload handled separately)

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

export async function GET() {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await db
    .from("trainers")
    .select("id, name, title, institution, signature_path, created_at")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ trainers: data });
}

const createSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  institution: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const { data, error } = await db
      .from("trainers")
      .insert({
        org_id: ctx.orgId,
        name: body.name,
        title: body.title ?? null,
        institution: body.institution ?? null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "create failed");

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "trainer.create",
      entity: "trainer",
      entity_id: data.id,
      metadata: { name: body.name },
    });
    return NextResponse.json({ id: data.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
