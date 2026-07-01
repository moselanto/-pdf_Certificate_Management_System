import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CourseCard, type CourseCardData } from "./CourseCard";

async function listCourses(): Promise<CourseCardData[]> {
  const db = createSupabaseServerClient();
  const { data } = await db
    .from("courses")
    .select("id, title, description, course_units(count)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description as string | null,
    unitCount: Array.isArray(c.course_units) ? c.course_units[0]?.count ?? 0 : 0,
  }));
}

export default async function CoursesPage() {
  let courses: CourseCardData[] = [];
  try {
    courses = await listCourses();
  } catch {
    courses = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Courses</h2>
          <p className="text-sm text-gray-500">
            Define a course once with its units. Selecting it at generation time
            fills the certificate back page automatically.
          </p>
        </div>
        <Link
          href="/courses/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New course
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          No courses yet. Create one to populate certificate back pages.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
