// POST   /api/templates/[id]/logo  — upload (or replace) the template's logo image
// DELETE /api/templates/[id]/logo  — remove the template's logo
//
// A template carries ONE logo (e.g. the issuing institution's logo). When the
// designer places a "logo" placeholder, the render engine draws this stored
// logo into that box on every certificate.
//
// POST accepts multipart/form-data with a single `logo` File (PNG or JPEG).
// We store it in the templates bucket and save the path on templates.logo_path
// (added in migration 006_template_logo.sql).

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

const ALLOWED = ["image/png", "image/jpeg"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Ownership (RLS scopes templates to the org).
  const { data: tpl } = await db
    .from("templates")
    .select("id, name, logo_path")
    .eq("id", params.id)
    .single();
  if (!tpl) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const form = await req.formData();
    const logo = form.get("logo");
    if (!(logo instanceof File) || logo.size === 0) {
      return NextResponse.json({ error: "logo image is required" }, { status: 400 });
    }
    if (!ALLOWED.includes(logo.type)) {
      return NextResponse.json(
        { error: "logo must be a PNG or JPEG image" },
        { status: 400 },
      );
    }
    // Guard against very large uploads (2 MB is plenty for a logo).
    if (logo.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "logo must be under 2 MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await logo.arrayBuffer());
    const ext = logo.type === "image/jpeg" ? "jpg" : "png";
    const path = `${ctx.orgId}/logos/${params.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, bytes, { contentType: logo.type, upsert: false });
    if (upErr) throw new Error(`logo upload failed: ${upErr.message}`);

    // Save the new path; remove the old logo file (best-effort).
    const { error: updErr } = await db
      .from("templates")
      .update({ logo_path: path })
      .eq("id", params.id);
    if (updErr) throw new Error(updErr.message);

    if (tpl.logo_path) {
      await db.storage.from(TEMPLATE_BUCKET).remove([tpl.logo_path]).catch(() => {});
    }

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "template.logo.upload",
      entity: "template",
      entity_id: params.id,
      metadata: { name: tpl.name },
    });

    // Signed URL so the designer can preview the logo immediately.
    const { data: signed } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(path, 60 * 30);

    return NextResponse.json({ logoPath: path, logoUrl: signed?.signedUrl ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: tpl } = await db
    .from("templates")
    .select("id, name, logo_path")
    .eq("id", params.id)
    .single();
  if (!tpl) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (tpl.logo_path) {
    await db.storage.from(TEMPLATE_BUCKET).remove([tpl.logo_path]).catch(() => {});
  }
  const { error } = await db
    .from("templates")
    .update({ logo_path: null })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "template.logo.delete",
    entity: "template",
    entity_id: params.id,
    metadata: { name: tpl.name },
  });

  return NextResponse.json({ deleted: true });
}

// GET /api/templates/[id]/logo — current logo signed URL (for the designer).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: tpl } = await db
    .from("templates")
    .select("logo_path")
    .eq("id", params.id)
    .single();
  if (!tpl) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!tpl.logo_path) return NextResponse.json({ logoUrl: null });
  const { data: signed } = await db.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(tpl.logo_path, 60 * 30);
  return NextResponse.json({ logoUrl: signed?.signedUrl ?? null });
}
