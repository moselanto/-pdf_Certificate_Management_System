// GET  /api/trainees  — list trainees for the user's org (optional ?q= search)
// POST /api/trainees  — create a trainee (also used for inline-create from the
//                        generate screen)

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

export async function GET(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  let query = db
    .from("trainees")
    .select("id, name, email, created_at")
    .order("name")
    .limit(200);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ trainees: data });
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
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
      .from("trainees")
      .insert({
        org_id: ctx.orgId,
        name: body.name,
        email: body.email ? body.email : null,
      })
      .select("id, name, email")
      .single();
    if (error || !data) throw new Error(error?.message ?? "create failed");

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "trainee.create",
      entity: "trainee",
      entity_id: data.id,
      metadata: { name: body.name },
    });
    return NextResponse.json({ trainee: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
