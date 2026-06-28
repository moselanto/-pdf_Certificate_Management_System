// POST /api/templates/ai-suggest
// AI helper for designing certificate templates. Generates SEVERAL visually
// DISTINCT certificate background images (via the image-generation service) so
// the user can pick one and create a real template with no manual upload.
//
// Returns: { suggestions: [{ id, name, description, palette, fields, backPage,
//            imageUrl, imageContentUri }], source }
//
// Each suggestion's imageContentUri points at the saved background in the
// Content Library; the "Use this template" flow (POST /api/templates/from-ai)
// wraps that image into a front-page PDF and registers the template.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateCertificateBackgrounds } from "@/lib/services/aiCertificateImages";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120; // image generation can take a while

async function currentContext(db: ReturnType<typeof createSupabaseServerClient>) {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("org_id, role")
    .eq("id", auth.user.id)
    .single();
  if (!profile) return null;
  return { userId: auth.user.id, orgId: profile.org_id, role: profile.role as string };
}

const bodySchema = z.object({
  brief: z.string().optional(),
  purpose: z.string().optional(),
  audience: z.string().optional(),
  tone: z.string().optional(),
  orientation: z.enum(["landscape", "portrait"]).optional(),
  includeBack: z.boolean().optional(),
  count: z.number().min(1).max(4).optional(),
  // A nonce lets "Generate more" force a fresh, different set.
  variation: z.number().optional(),
});

const STANDARD_FIELDS = [
  "Recipient name",
  "Course / programme title",
  "Issue date",
  "Certificate number",
  "Trainer signature",
  "Issuing institution",
  "Verification QR code",
];

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const input = bodySchema.parse(await req.json());
    const count = input.count ?? 3;
    const includeBack =
      input.includeBack ??
      /course|module|unit|training/i.test(input.purpose || input.brief || "");

    const designs = await generateCertificateBackgrounds({
      orgId: ctx.orgId,
      brief: input.brief,
      purpose: input.purpose,
      audience: input.audience,
      tone: input.tone,
      orientation: input.orientation ?? "landscape",
      count,
      variation: input.variation ?? 0,
    });

    const suggestions = designs.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      palette: d.palette,
      fields: STANDARD_FIELDS,
      backPage: includeBack
        ? "Course units / modules covered, drawn dynamically from the selected course."
        : undefined,
      imageUrl: d.imageUrl,
      imageContentUri: d.imageContentUri,
      orientation: input.orientation ?? "landscape",
    }));

    return NextResponse.json({ suggestions, source: "ai" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
