// DELETE /api/courses/[id] — delete a course and its units. Blocked if any
// certificate references the course (preserves history).

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data: course } = await db
    .from("courses")
    .select("id, title")
    .eq("id", params.id)
    .single();
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { count } = await db
    .from("certificates")
    .select("*", { count: "exact", head: true })
    .eq("course_id", params.id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This course has issued certificates and can't be deleted (history is preserved)." },
      { status: 409 },
    );
  }

  await db.from("course_units").delete().eq("course_id", params.id);
  const { error: delErr } = await db.from("courses").delete().eq("id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "course.delete",
    entity: "course",
    entity_id: params.id,
    metadata: { title: course.title },
  });

  return NextResponse.json({ deleted: true });
}
