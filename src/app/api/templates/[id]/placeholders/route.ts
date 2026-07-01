// GET /api/templates/[id]/placeholders  — load placeholders for a template
// PUT /api/templates/[id]/placeholders  — replace the full placeholder set
//
// The designer saves the entire layout at once (simplest correct model): we
// delete the template's existing placeholders and insert the new set inside a
// single logical operation, scoped to the user's org via RLS.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { placeholderSchema, designElementSchema } from "@/lib/domain/schemas";
import { z } from "zod";

export const runtime = "nodejs";

async function ownsTemplate(
  db: ReturnType<typeof createSupabaseServerClient>,
  templateId: string,
) {
  const { data } = await db.from("templates").select("id").eq("id", templateId).single();
  return Boolean(data); // RLS already restricts to the user's org
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const { data, error } = await db
    .from("placeholders")
    .select("*")
    .eq("template_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const placeholders = (data ?? []).map((r) => ({
    id: String(r.id),
    page: r.page,
    kind: r.kind,
    fieldKey: r.field_key,
    label: r.label,
    x: Number(r.x),
    y: Number(r.y),
    width: r.width == null ? undefined : Number(r.width),
    height: r.height == null ? undefined : Number(r.height),
    fontSize: Number(r.font_size),
    fontFamily: r.font_family,
    color: r.color,
    align: r.align,
    qrDark: r.qr_dark == null ? undefined : String(r.qr_dark),
    qrLight: r.qr_light == null ? undefined : String(r.qr_light),
    qrTransparent: r.qr_transparent == null ? undefined : Boolean(r.qr_transparent),
  }));

  // Design elements (from-scratch artwork) live as JSONB on the template.
  const { data: tpl } = await db
    .from("templates")
    .select("design_elements")
    .eq("id", params.id)
    .single();
  const designElements = Array.isArray(tpl?.design_elements) ? tpl!.design_elements : [];

  return NextResponse.json({ placeholders, designElements });
}

const putSchema = z.object({
  placeholders: z.array(placeholderSchema),
  // Optional so existing PDF-template saves (placeholders only) keep working.
  designElements: z.array(designElementSchema).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await ownsTemplate(db, params.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const { placeholders, designElements } = putSchema.parse(await req.json());

    // Persist design elements (from-scratch artwork) as JSONB on the template.
    // Only write when the client sent them, so PDF-template saves that omit the
    // field don't wipe any existing artwork.
    if (designElements !== undefined) {
      const { error: deErr } = await db
        .from("templates")
        .update({ design_elements: designElements })
        .eq("id", params.id);
      if (deErr) throw new Error(deErr.message);
    }

    // Replace set: clear then insert.
    const { error: delErr } = await db
      .from("placeholders")
      .delete()
      .eq("template_id", params.id);
    if (delErr) throw new Error(delErr.message);

    if (placeholders.length > 0) {
      const rows = placeholders.map((p) => ({
        template_id: params.id,
        page: p.page,
        kind: p.kind,
        field_key: p.fieldKey,
        label: p.label,
        x: p.x,
        y: p.y,
        width: p.width ?? null,
        height: p.height ?? null,
        font_size: p.fontSize,
        font_family: p.fontFamily,
        color: p.color,
        align: p.align,
        qr_dark: p.qrDark ?? null,
        qr_light: p.qrLight ?? null,
        qr_transparent: p.qrTransparent ?? false,
      }));
      const { error: insErr } = await db.from("placeholders").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return NextResponse.json({ saved: placeholders.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
