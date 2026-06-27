// GET  /api/courses  — list courses for the user's org (with unit counts)
// POST /api/courses  — create a course

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
    .from("courses")
    .select("id, title, description, created_at, course_units(count)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const courses = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    unitCount: Array.isArray(c.course_units) ? c.course_units[0]?.count ?? 0 : 0,
  }));
  return NextResponse.json({ courses });
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
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
      .from("courses")
      .insert({ org_id: ctx.orgId, title: body.title, description: body.description ?? null })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "create failed");

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "course.create",
      entity: "course",
      entity_id: data.id,
      metadata: { title: body.title },
    });
    return NextResponse.json({ id: data.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
