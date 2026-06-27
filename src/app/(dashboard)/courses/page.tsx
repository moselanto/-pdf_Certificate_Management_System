import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function listCourses() {
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
  let courses: Awaited<ReturnType<typeof listCourses>> = [];
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
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
                {c.title}
              </h3>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{c.description}</p>
              )}
              <p className="mt-3 text-xs font-medium text-brand-700">
                {c.unitCount} unit{c.unitCount === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
