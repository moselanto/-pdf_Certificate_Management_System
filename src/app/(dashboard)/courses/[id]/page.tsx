import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CourseUnitsEditor } from "./CourseUnitsEditor";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const db = createSupabaseServerClient();
  const { data: course } = await db
    .from("courses")
    .select("id, title, description")
    .eq("id", params.id)
    .single();
  if (!course) notFound();

  const { data: unitRows } = await db
    .from("course_units")
    .select("*")
    .eq("course_id", params.id)
    .order("sort_order");

  const units = (unitRows ?? []).map((u) => ({
    title: u.title as string,
    section: (u.section ?? undefined) as string | undefined,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{course.title}</h2>
        {course.description && (
          <p className="text-sm text-gray-500">{course.description}</p>
        )}
      </div>
      <CourseUnitsEditor courseId={course.id} initialUnits={units} />
    </div>
  );
}
