// ============================================================================
// aiCertificateImages — generate several visually DISTINCT certificate
// background images for the "Design with AI" helper.
//
// IMPLEMENTATION NOTE (image provider):
//   This project runs inside Town, whose image generation is exposed to the
//   assistant as a tool, not as a public REST endpoint we can call from a
//   Next.js route at runtime. So at deploy time you wire ONE of the following
//   via env, and this module calls it:
//     - OPENAI_API_KEY            -> uses OpenAI Images (gpt-image-1)
//     - REPLICATE_API_TOKEN       -> (optional) a Replicate model
//   If no provider key is configured, we throw a clear, actionable error so the
//   UI can tell the user how to enable it (rather than silently failing).
//
// Each generated image is uploaded to Supabase Storage (templates bucket) and a
// short-lived signed URL is returned for the thumbnail. The stored path is
// returned as `storagePath` so "Use this template" can re-read the bytes and
// wrap them into a front-page PDF.
// ============================================================================

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";

export interface CertificateDesign {
  id: string;
  name: string;
  description: string;
  palette: string[];
  imageUrl: string; // signed URL for preview
  imageContentUri: string; // storage path, used by from-ai to build the PDF
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

// A rotating palette of distinct design directions so each sample (and each
// "generate more" batch) looks different.
const STYLE_PRESETS = [
  {
    name: "Classic Navy & Gold",
    palette: ["#0B3D67", "#C9A227", "#FFFDF7"],
    prompt:
      "Elegant double border in navy blue and gold with ornate corner flourishes, a faint guilloche watermark on ivory, and a gold medallion seal at top center. Formal and prestigious.",
  },
  {
    name: "Modern Minimal",
    palette: ["#2563EB", "#111827", "#FFFFFF"],
    prompt:
      "Clean minimal design: a thin single-color accent rule along the top and bottom, generous white space, a small geometric emblem in one corner. Contemporary and uncluttered.",
  },
  {
    name: "Elegant Emerald",
    palette: ["#0F766E", "#B08D57", "#FBFBF8"],
    prompt:
      "Refined emerald-green and soft bronze border with delicate botanical filigree corners, a subtle laurel wreath at top center, on warm off-white. Sophisticated.",
  },
  {
    name: "Royal Purple Crest",
    palette: ["#6D28D9", "#D4AF37", "#FAF7FF"],
    prompt:
      "Deep purple and gold heraldic frame with a crest/ribbon emblem at top center and fine line ornamentation in the corners, on a pale lilac-tinted background. Distinguished.",
  },
  {
    name: "Corporate Slate",
    palette: ["#334155", "#0EA5E9", "#FFFFFF"],
    prompt:
      "Professional slate-gray frame with a single sky-blue accent stripe, squared modern corners, and a simple shield emblem. Business-like and trustworthy.",
  },
  {
    name: "Warm Burgundy",
    palette: ["#7F1D1D", "#C9A227", "#FFFBF5"],
    prompt:
      "Burgundy and gold ornate border with classic scrollwork corners and a circular seal at top center, on cream. Traditional and warm.",
  },
];

function buildPrompt(style: (typeof STYLE_PRESETS)[number], args: GenArgs): string {
  const subject = args.purpose || args.brief || "certificate of completion";
  const tone = args.tone ? `${args.tone} tone. ` : "";
  return [
    `A blank professional ${subject} background template, ${args.orientation} orientation.`,
    style.prompt,
    tone,
    "Leave the entire center empty for text to be added later.",
    "ABSOLUTELY NO text, no words, no letters, no numbers, no placeholder writing anywhere — only the decorative border, background texture, and emblem.",
    "Print-ready, high resolution, edges clean to the page margin.",
  ].join(" ");
}

/**
 * Generate `count` distinct certificate backgrounds. Uses OpenAI Images when
 * OPENAI_API_KEY is set. Each image is stored and a signed preview URL returned.
 */
export async function generateCertificateBackgrounds(
  args: GenArgs,
): Promise<CertificateDesign[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI design needs an image provider. Add OPENAI_API_KEY to your environment to enable 'Design with AI'.",
    );
  }

  const db = createSupabaseServiceClient();
  const size = args.orientation === "portrait" ? "1024x1536" : "1536x1024";

  // Pick `count` distinct presets, rotated by the variation nonce so
  // "generate more" yields a different set each time.
  const start = Math.abs(args.variation) % STYLE_PRESETS.length;
  const picks = Array.from({ length: args.count }, (_, i) =>
    STYLE_PRESETS[(start + i) % STYLE_PRESETS.length],
  );

  const results: CertificateDesign[] = [];

  for (let i = 0; i < picks.length; i++) {
    const style = picks[i];
    const prompt = buildPrompt(style, args);

    // 1. Generate the image (OpenAI Images, base64 response).
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        n: 1,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`image generation failed: ${res.status} ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const b64: string | undefined = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("image generation returned no image");
    const bytes = Uint8Array.from(Buffer.from(b64, "base64"));

    // 2. Store it (PNG) under the org's folder.
    const stamp = Date.now();
    const path = `${args.orgId}/ai/${stamp}-${i}.png`;
    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`store background failed: ${upErr.message}`);

    // 3. Signed preview URL.
    const { data: signed } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(path, 60 * 30);

    results.push({
      id: `${stamp}-${i}`,
      name: style.name,
      description: `${style.name} — generated background for "${args.purpose || args.brief || "certificate"}".`,
      palette: style.palette,
      imageUrl: signed?.signedUrl ?? "",
      imageContentUri: path,
    });
  }

  return results;
}
