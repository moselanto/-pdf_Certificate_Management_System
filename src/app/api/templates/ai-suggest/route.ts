// POST /api/templates/ai-suggest
// AI helper for designing certificate templates. Takes a free-text brief and/or
// guided answers (purpose, audience, tone, orientation, include-back-page) and
// returns 2-3 sample template "briefs": a name, a short design description, a
// suggested colour palette, and the recommended fields/placeholders to add in
// the designer.
//
// Uses OpenAI when OPENAI_API_KEY is set; otherwise returns a solid rule-based
// fallback so the feature always works (no hard dependency on a paid key).

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

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
});

interface TemplateSuggestion {
  name: string;
  description: string;
  palette: string[];
  fields: string[];
  backPage?: string;
}

const SYSTEM_PROMPT = `You are a certificate design assistant for "CertForge", a PDF certificate generator.
The app overlays fields on an uploaded PDF design. Suggested fields map to placeholder kinds the user adds in the designer: recipient name, course/title, issue date, certificate number, trainer signature, institution/issuer, and a verification QR code.
Given the user's brief, return 2-3 distinct certificate template ideas.
Respond ONLY with strict JSON of the shape:
{"suggestions":[{"name":string,"description":string,"palette":[hex,...],"fields":[string,...],"backPage":string}]}
Keep names short, descriptions 1-2 sentences, palette 2-4 hex colours, fields a concise list, and backPage a short note on what the back page should contain (e.g. course units list) or omit it if not needed.`;

function ruleBasedFallback(input: z.infer<typeof bodySchema>): TemplateSuggestion[] {
  const purpose = input.purpose || input.brief || "course completion";
  const tone = (input.tone || "professional").toLowerCase();
  const includeBack = input.includeBack ?? /course|module|unit|training/i.test(purpose);

  const baseFields = [
    "Recipient name",
    "Course / programme title",
    "Issue date",
    "Certificate number",
    "Trainer signature",
    "Issuing institution",
    "Verification QR code",
  ];
  const backNote = includeBack
    ? "List the course units / modules covered, drawn dynamically from the selected course."
    : undefined;

  const formal = {
    name: `${titleCase(purpose)} — Classic`,
    description: `A formal, ${tone} certificate with a centered title, a gold/navy border feel, and clear space for the recipient name.`,
    palette: ["#0B3D67", "#C9A227", "#1F2937"],
    fields: baseFields,
    backPage: backNote,
  };
  const modern = {
    name: `${titleCase(purpose)} — Modern`,
    description: "A clean, minimal layout with a single accent colour, generous whitespace, and a QR code in the lower corner.",
    palette: ["#2563EB", "#111827"],
    fields: baseFields,
    backPage: backNote,
  };
  const elegant = {
    name: `${titleCase(purpose)} — Elegant`,
    description: "A refined design with a serif title, subtle emblem space at top-center, and signature line(s) at the bottom.",
    palette: ["#6D28D9", "#0F766E", "#1F2937"],
    fields: baseFields,
    backPage: backNote,
  };

  return [formal, modern, elegant];
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40);
}

async function openAiSuggest(
  input: z.infer<typeof bodySchema>,
): Promise<TemplateSuggestion[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const userMsg = [
    input.brief ? `Brief: ${input.brief}` : "",
    input.purpose ? `Purpose: ${input.purpose}` : "",
    input.audience ? `Audience: ${input.audience}` : "",
    input.tone ? `Tone: ${input.tone}` : "",
    input.orientation ? `Orientation: ${input.orientation}` : "",
    input.includeBack !== undefined ? `Include back page: ${input.includeBack}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg || "Suggest general-purpose certificate templates." },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const suggestions = parsed?.suggestions;
    if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
    // Light shape validation.
    return suggestions.slice(0, 3).map((s: Record<string, unknown>) => ({
      name: String(s.name ?? "Certificate"),
      description: String(s.description ?? ""),
      palette: Array.isArray(s.palette) ? (s.palette as string[]).slice(0, 4) : [],
      fields: Array.isArray(s.fields) ? (s.fields as string[]) : [],
      backPage: s.backPage ? String(s.backPage) : undefined,
    }));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const input = bodySchema.parse(await req.json());
    const ai = await openAiSuggest(input);
    const suggestions = ai ?? ruleBasedFallback(input);
    return NextResponse.json({
      suggestions,
      source: ai ? "ai" : "builtin",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
