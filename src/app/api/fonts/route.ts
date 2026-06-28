// GET    /api/fonts — list the org's custom fonts (family + id).
// POST   /api/fonts — upload a custom font (multipart: `font` file + `family`).
//                     Accepts .ttf / .otf, <2MB. Owner/admin/editor.
// DELETE /api/fonts?id=... — remove a custom font.
//
// Custom fonts let a placeholder's font_family reference an uploaded typeface.
// The render engine (overlay.ts) resolves a placeholder's font_family against
// the org's fonts first, embedding the stored file via @pdf-lib/fontkit, and
// falls back to the standard fonts when no match exists.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";

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

// TrueType/OpenType. Some browsers send octet-stream, so we also accept by
// extension below.
const ALLOWED_TYPES = ["font/ttf", "font/otf", "application/x-font-ttf", "application/octet-stream"];
const ALLOWED_EXT = [".ttf", ".otf"];

export async function GET() {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await db
    .from("fonts")
    .select("id, family, created_at")
    .order("family", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ fonts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("font");
    const family = String(form.get("family") ?? "").trim();
    if (!family) {
      return NextResponse.json({ error: "a font family name is required" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "a font file is required" }, { status: 400 });
    }
    const lower = file.name.toLowerCase();
    const extOk = ALLOWED_EXT.some((e) => lower.endsWith(e));
    if (!extOk && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "font must be a .ttf or .otf file" },
        { status: 400 },
      );
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "font must be under 2 MB" }, { status: 400 });
    }

    const ext = lower.endsWith(".otf") ? "otf" : "ttf";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${ctx.orgId}/fonts/${Date.now()}-${family.replace(/[^a-z0-9]+/gi, "_")}.${ext}`;

    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, bytes, { contentType: ext === "otf" ? "font/otf" : "font/ttf", upsert: false });
    if (upErr) throw new Error(`font upload failed: ${upErr.message}`);

    // Upsert the row (org_id, family) is unique — replacing the file path when
    // re-uploading the same family. Clean up the previous file on replace.
    const { data: existing } = await db
      .from("fonts")
      .select("id, file_path")
      .eq("family", family)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await db
        .from("fonts")
        .update({ file_path: path })
        .eq("id", existing.id);
      if (updErr) throw new Error(updErr.message);
      if (existing.file_path && existing.file_path !== path) {
        await db.storage.from(TEMPLATE_BUCKET).remove([existing.file_path]).catch(() => {});
      }
    } else {
      const { error: insErr } = await db
        .from("fonts")
        .insert({ org_id: ctx.orgId, family, file_path: path });
      if (insErr) throw new Error(insErr.message);
    }

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "font.upload",
      entity: "font",
      entity_id: null,
      metadata: { family },
    });

    return NextResponse.json({ family });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "font id is required" }, { status: 400 });

  const { data: font } = await db
    .from("fonts")
    .select("id, family, file_path")
    .eq("id", id)
    .single();
  if (!font) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (font.file_path) {
    await db.storage.from(TEMPLATE_BUCKET).remove([font.file_path]).catch(() => {});
  }
  const { error } = await db.from("fonts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "font.delete",
    entity: "font",
    entity_id: id,
    metadata: { family: font.family },
  });

  return NextResponse.json({ deleted: true });
}
