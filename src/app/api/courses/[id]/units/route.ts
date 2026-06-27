// GET /api/courses/[id]/units  — ordered units/competencies for a course
// PUT /api/courses/[id]/units  — replace the unit list (preserving order)
//
// Like placeholders, the editor saves the whole ordered list at once. We
// re-derive sort_order from array position so drag-reordering "just works".

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

async function ownsCourse(
  db: ReturnType<typeof createSupabaseServerClient>,
  courseId: string,
) {
  const { data } = await db.from("courses").select("id").eq("id", courseId).single();
  return Boolean(data); // RLS restricts to the user's org
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const { data, error } = await db
    .from("course_units")
    .select("id, sort_order, title")
    .eq("course_id", params.id)
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    units: (data ?? []).map((u) => ({ id: u.id, sortOrder: u.sort_order, title: u.title })),
  });
}

const putSchema = z.object({
  units: z.array(z.object({ title: z.string().min(1) })),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await ownsCourse(db, params.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const { units } = putSchema.parse(await req.json());

    const { error: delErr } = await db
      .from("course_units")
      .delete()
      .eq("course_id", params.id);
    if (delErr) throw new Error(delErr.message);

    if (units.length > 0) {
      const rows = units.map((u, i) => ({
        course_id: params.id,
        sort_order: i,
        title: u.title,
      }));
      const { error: insErr } = await db.from("course_units").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return NextResponse.json({ saved: units.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
