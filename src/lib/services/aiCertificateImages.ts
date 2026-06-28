// ============================================================================
// aiCertificateDesigns — OFFLINE certificate background generator for the
// "Design with AI" helper. NO external API, NO per-image cost.
//
// Produces several visually-distinct certificate backgrounds by rendering pure
// vector artwork (via pdf-lib) from a rotating set of style presets. Each
// background is rendered to a single-page PDF, stored in the templates bucket,
// and a signed URL is returned for an inline preview (the UI previews PDFs
// natively, the same way TemplateCard does — no rasterization needed).
//
// The stored path is returned as `imageContentUri`; "Use this template"
// (/api/templates/from-ai) copies that PDF straight in as the template front.
// ============================================================================

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
import { STYLE_PRESETS, buildBackgroundPdf } from "@/lib/pdf/certBackground";

export interface CertificateDesign {
  id: string;
  styleId: string;
  name: string;
  description: string;
  palette: string[];
  imageUrl: string; // signed URL to the background PDF (inline preview)
  imageContentUri: string; // storage path, used by from-ai to build the template
}

interface GenArgs {
  orgId: string;
  brief?: string;
  purpose?: string;
  audience?: string;
  tone?: string;
  orientation: "landscape" | "portrait";
  count: number;
  variation: number;
}

// A4-ish page sizes in points (must match from-ai's PAGE constant).
const PAGE = {
  landscape: { w: 842, h: 595 },
  portrait: { w: 595, h: 842 },
};

/**
 * Generate `count` distinct certificate backgrounds, fully offline.
 * Each background is rendered to a PDF, stored, and a signed preview URL
 * returned. `variation` rotates the preset selection so "Generate more"
 * yields a different set each time.
 */
export async function generateCertificateBackgrounds(
  args: GenArgs,
): Promise<CertificateDesign[]> {
  const db = createSupabaseServiceClient();
  const { w: pageW, h: pageH } = PAGE[args.orientation];

  // Pick `count` distinct presets, rotated by the variation nonce.
  const start = Math.abs(args.variation) % STYLE_PRESETS.length;
  const picks = Array.from({ length: args.count }, (_, i) =>
    STYLE_PRESETS[(start + i) % STYLE_PRESETS.length],
  );

  const results: CertificateDesign[] = [];

  for (let i = 0; i < picks.length; i++) {
    const preset = picks[i];

    // 1. Render the background to a single-page PDF (pure vector, no API).
    const pdfBytes = await buildBackgroundPdf(preset.id, pageW, pageH);

    // 2. Store it under the org's ai folder.
    const stamp = Date.now();
    const path = `${args.orgId}/ai/${stamp}-${i}-${preset.id}.pdf`;
    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`store background failed: ${upErr.message}`);

    // 3. Signed preview URL (30 min).
    const { data: signed } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(path, 60 * 30);

    const subject = args.purpose || args.brief || "certificate";
    results.push({
      id: `${stamp}-${i}`,
      styleId: preset.id,
      name: preset.name,
      description: `${preset.description} Tailored for "${subject}".`,
      palette: preset.palette,
      imageUrl: signed?.signedUrl ?? "",
      imageContentUri: path,
    });
  }

  return results;
}
