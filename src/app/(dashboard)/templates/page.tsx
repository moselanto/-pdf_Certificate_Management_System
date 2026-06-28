import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TemplateCard, type TemplateCardData } from "./TemplateCard";

async function listTemplates(): Promise<TemplateCardData[]> {
  const db = createSupabaseServerClient();
  const { data } = await db
    .from("templates")
    .select("id, name, back_pdf_path, page_width, page_height, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    hasBack: Boolean(t.back_pdf_path),
    pageWidth: t.page_width,
    pageHeight: t.page_height,
  }));
}

export default async function TemplatesPage() {
  let templates: TemplateCardData[] = [];
  try {
    templates = await listTemplates();
  } catch {
    templates = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Certificate Templates</h2>
          <p className="text-sm text-gray-500">
            Upload a front (and optional back) PDF once, then position your fields.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm text-gray-500">
            No templates yet. Upload your first certificate design to get started.
          </p>
          <Link
            href="/templates/new"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Upload a template
          </Link>
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
