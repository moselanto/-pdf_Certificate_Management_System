import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TemplateCard, type TemplateCardData } from "./TemplateCard";
import { AiTemplateHelper } from "./AiTemplateHelper";

async function listTemplates(showArchived: boolean): Promise<TemplateCardData[]> {
  const db = createSupabaseServerClient();
  let query = db
    .from("templates")
    .select("id, name, back_pdf_path, page_width, page_height, archived_at, created_at")
    .order("created_at", { ascending: false });
  // Active list hides archived templates; the archived view shows only those.
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data } = await query;
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    hasBack: Boolean(t.back_pdf_path),
    pageWidth: t.page_width,
    pageHeight: t.page_height,
    archived: Boolean(t.archived_at),
  }));
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const showArchived = searchParams.view === "archived";
  let templates: TemplateCardData[] = [];
  try {
    templates = await listTemplates(showArchived);
  } catch {
    templates = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Certificate Templates</h2>
          <p className="text-sm text-gray-500">
            Generate a design with AI, or upload your own front (and optional back) PDF, then position your fields.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New template
        </Link>
      </div>

      {/* Active / Archived view toggle */}
      <div className="flex gap-2 text-sm">
        <Link
          href="/templates"
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            !showArchived
              ? "bg-brand-600 text-white"
              : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Active
        </Link>
        <Link
          href="/templates?view=archived"
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            showArchived
              ? "bg-brand-600 text-white"
              : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Archived
        </Link>
      </div>

      {/* AI helper only on the active view. */}
      {!showArchived && <AiTemplateHelper />}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm text-gray-500">
            {showArchived
              ? "No archived templates."
              : "No templates yet. Generate one with AI above, or upload your own design to get started."}
          </p>
          {!showArchived && (
            <Link
              href="/templates/new"
              className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Upload a template
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
