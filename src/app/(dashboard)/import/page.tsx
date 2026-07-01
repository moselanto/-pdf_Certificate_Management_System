import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BulkImportWizard } from "./BulkImportWizard";

// Bulk Import: upload an Excel/CSV, map columns to certificate fields, then
// generate hundreds of certificates at once and download them as a ZIP.
export default async function ImportPage() {
  const db = createSupabaseServerClient();
  const [{ data: templates }, { data: courses }, { data: trainers }] =
    await Promise.all([
      db.from("templates").select("id, name").order("name"),
      db.from("courses").select("id, title").order("title"),
      db.from("trainers").select("id, name").order("name"),
    ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bulk import</h2>
        <p className="text-sm text-gray-500">
          Upload a spreadsheet of recipients, map the columns, and generate
          every certificate in one go. Download them all as a ZIP.
        </p>
      </div>
      <BulkImportWizard
        templates={templates ?? []}
        courses={courses ?? []}
        trainers={trainers ?? []}
      />
    </div>
  );
}
