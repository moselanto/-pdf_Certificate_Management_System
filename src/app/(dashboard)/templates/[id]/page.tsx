import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
import { TemplateDesignerClient } from "./TemplateDesignerClient";

// Server component: load the template + signed URLs for its front (and back, if
// present) PDFs, then hand off to the client designer which rasterizes the PDFs
// for the editor background and manages drag-and-drop + save across both pages.
export default async function TemplateDesignPage({
  params,
}: {
  params: { id: string };
}) {
  const db = createSupabaseServerClient();

  const { data: tpl } = await db
    .from("templates")
    .select("id, name, front_pdf_path, back_pdf_path, page_width, page_height")
    .eq("id", params.id)
    .single();

  if (!tpl) notFound();

  // Signed URLs let the browser fetch the PDF bytes to rasterize the backdrops.
  const { data: frontSigned } = await db.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(tpl.front_pdf_path, 60 * 30);

  let backUrl = "";
  if (tpl.back_pdf_path) {
    const { data: backSigned } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(tpl.back_pdf_path, 60 * 30);
    backUrl = backSigned?.signedUrl ?? "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{tpl.name}</h2>
        <p className="text-sm text-gray-500">
          Drag fields onto the certificate, then save. Use the Front / Back
          toggle to design each page, and Live preview to see a rendered PDF.
        </p>
      </div>

      <TemplateDesignerClient
        templateId={tpl.id}
        frontPdfUrl={frontSigned?.signedUrl ?? ""}
        backPdfUrl={backUrl}
        pageWidth={tpl.page_width ?? 842}
        pageHeight={tpl.page_height ?? 595}
      />
    </div>
  );
}
