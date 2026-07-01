// GET    /api/fonts — list the org's custom fonts (family + id).
// POST   /api/fonts — upload custom font(s). Two modes:
//                     • Single: multipart `font` file + `family` name.
//                     • Bulk:   multipart with one or more `fonts` files; the
//                               family name is derived from each file name
//                               (e.g. "MyriadPro-Regular.ttf" -> "Myriad Pro").
//                     Accepts .ttf / .otf, <2MB each. Owner/admin/editor.
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

    // Bulk mode: one or more files under `fonts`. Family is derived per file
    // from its file name. Single mode: one `font` file + an explicit `family`.
    const bulkFiles = form.getAll("fonts").filter((f): f is File => f instanceof File && f.size > 0);

    if (bulkFiles.length) {
      const uploaded: string[] = [];
      const failed: { file: string; error: string }[] = [];
      for (const file of bulkFiles) {
        const family = familyFromFileName(file.name);
        const res = await saveFont(db, ctx, file, family);
        if (res.ok) uploaded.push(res.family);
        else failed.push({ file: file.name, error: res.error });
      }
      return NextResponse.json({ uploaded, failed });
    }

    // Single-file mode (backwards compatible).
    const file = form.get("font");
    const family = String(form.get("family") ?? "").trim();
    if (!family) {
      return NextResponse.json({ error: "a font family name is required" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "a font file is required" }, { status: 400 });
    }
    const res = await saveFont(db, ctx, file, family);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ family: res.family });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/**
 * Derive a human font family name from a font file name, e.g.
 * "MyriadPro-Regular.ttf" -> "Myriad Pro", "EdwardianScriptITC.otf" ->
 * "Edwardian Script ITC". Best-effort; the user can rename later if needed.
 */
function familyFromFileName(name: string): string {
  let base = name.replace(/\.(ttf|otf)$/i, "");
  // Drop common weight/style suffixes after a hyphen or underscore.
  base = base.replace(/[-_](regular|bold|italic|oblique|medium|light|thin|black|semibold|regular italic)$/i, "");
  // Split CamelCase and separators into words.
  base = base
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return base || name;
}

/**
 * Validate + store a single font file for the org, upserting on (org_id,
 * family). Returns a discriminated result rather than throwing so bulk uploads
 * can report per-file outcomes.
 */
async function saveFont(
  db: ReturnType<typeof createSupabaseServerClient>,
  ctx: { userId: string; orgId: string; role: string },
  file: File,
  family: string,
): Promise<{ ok: true; family: string } | { ok: false; error: string }> {
  if (!family) return { ok: false, error: "could not determine a font family name" };

  const lower = file.name.toLowerCase();
  const extOk = ALLOWED_EXT.some((e) => lower.endsWith(e));
  if (!extOk && !ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "font must be a .ttf or .otf file" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "font must be under 2 MB" };
  }

  const ext = lower.endsWith(".otf") ? "otf" : "ttf";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${ctx.orgId}/fonts/${Date.now()}-${family.replace(/[^a-z0-9]+/gi, "_")}.${ext}`;

  const { error: upErr } = await db.storage
    .from(TEMPLATE_BUCKET)
    .upload(path, bytes, { contentType: ext === "otf" ? "font/otf" : "font/ttf", upsert: false });
  if (upErr) return { ok: false, error: `font upload failed: ${upErr.message}` };

  // Upsert the row ((org_id, family) is unique) — replacing the file path when
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
    if (updErr) return { ok: false, error: updErr.message };
    if (existing.file_path && existing.file_path !== path) {
      await db.storage.from(TEMPLATE_BUCKET).remove([existing.file_path]).catch(() => {});
    }
  } else {
    const { error: insErr } = await db
      .from("fonts")
      .insert({ org_id: ctx.orgId, family, file_path: path });
    if (insErr) return { ok: false, error: insErr.message };
  }

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "font.upload",
    entity: "font",
    entity_id: null,
    metadata: { family },
  });

  return { ok: true, family };
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
