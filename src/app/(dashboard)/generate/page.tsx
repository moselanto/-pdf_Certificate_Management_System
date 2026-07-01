import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GenerateForm } from "./GenerateForm";

// Loads the option lists (templates, courses, trainers, trainees) server-side
// so the generate form is ready to use immediately. Archived templates are
// excluded so you can't generate from a retired design.
export default async function GeneratePage() {
  const db = createSupabaseServerClient();

  const [{ data: templates }, { data: courses }, { data: trainers }, { data: trainees }] =
    await Promise.all([
      db
        .from("templates")
        .select("id, name")
        .is("archived_at", null)
        .order("name"),
      db.from("courses").select("id, title").order("title"),
      db.from("trainers").select("id, name").order("name"),
      db.from("trainees").select("id, name, email").order("name"),
    ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Generate certificate</h2>
        <p className="text-sm text-gray-500">
          Pick a template and fill in the details. We mint a unique number,
          embed a verification QR, and produce a print-ready PDF.
        </p>
      </div>
      <GenerateForm
        templates={templates ?? []}
        courses={courses ?? []}
        trainers={trainers ?? []}
        trainees={trainees ?? []}
      />
    </div>
  );
}
