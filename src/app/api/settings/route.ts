// GET    /api/settings — return the org name + default-logo URL + account info.
// PATCH  /api/settings — update the organisation name (used as the default
//   "Issued by" on verification pages). Admin/owner only.
// POST   /api/settings — upload/replace the org DEFAULT LOGO (multipart, `logo`
//   field; PNG/JPEG, <2MB). Templates with a placed "logo" field but no
//   template-specific logo fall back to this. Admin/owner only.
// DELETE /api/settings — remove the org default logo. Admin/owner only.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
import { z } from "zod";

export const runtime = "nodejs";

const ALLOWED_LOGO = ["image/png", "image/jpeg"];

async function currentContext(db: ReturnType<typeof createSupabaseServerClient>) {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("org_id, role")
    .eq("id", auth.user.id)
    .single();
  if (!profile) return null;
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    orgId: profile.org_id,
    role: profile.role as string,
  };
}

export async function GET() {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: org } = await db
    .from("organizations")
    .select("name, logo_path")
    .eq("id", ctx.orgId)
    .single();

  // Signed URL so the settings UI can preview the current default logo.
  let logoUrl: string | null = null;
  if (org?.logo_path) {
    const { data: signed } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(org.logo_path, 60 * 30);
    logoUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    orgName: org?.name ?? "",
    logoUrl,
    email: ctx.email,
    role: ctx.role,
  });
}

const patchSchema = z.object({
  orgName: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change organisation settings." },
      { status: 403 },
    );
  }

  try {
    const body = patchSchema.parse(await req.json());
    const { error } = await db
      .from("organizations")
      .update({ name: body.orgName })
      .eq("id", ctx.orgId);
    if (error) throw new Error(error.message);

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "org.update",
      entity: "organization",
      entity_id: ctx.orgId,
      metadata: { name: body.orgName },
    });

    return NextResponse.json({ orgName: body.orgName });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// POST /api/settings — upload/replace the org default logo (multipart `logo`).
export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change organisation settings." },
      { status: 403 },
    );
  }

  try {
    const form = await req.formData();
    const logo = form.get("logo");
    if (!(logo instanceof File) || logo.size === 0) {
      return NextResponse.json({ error: "logo image is required" }, { status: 400 });
    }
    if (!ALLOWED_LOGO.includes(logo.type)) {
      return NextResponse.json(
        { error: "logo must be a PNG or JPEG image" },
        { status: 400 },
      );
    }
    if (logo.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "logo must be under 2 MB" }, { status: 400 });
    }

    // Read the existing path so we can clean it up after a successful replace.
    const { data: org } = await db
      .from("organizations")
      .select("logo_path")
      .eq("id", ctx.orgId)
      .single();

    const bytes = new Uint8Array(await logo.arrayBuffer());
    const ext = logo.type === "image/jpeg" ? "jpg" : "png";
    const path = `${ctx.orgId}/org-logo/${Date.now()}.${ext}`;

    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, bytes, { contentType: logo.type, upsert: false });
    if (upErr) throw new Error(`logo upload failed: ${upErr.message}`);

    const { error: updErr } = await db
      .from("organizations")
      .update({ logo_path: path })
      .eq("id", ctx.orgId);
    if (updErr) throw new Error(updErr.message);

    if (org?.logo_path) {
      await db.storage.from(TEMPLATE_BUCKET).remove([org.logo_path]).catch(() => {});
    }

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "org.logo.upload",
      entity: "organization",
      entity_id: ctx.orgId,
      metadata: {},
    });

    const { data: signed } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(path, 60 * 30);
    return NextResponse.json({ logoUrl: signed?.signedUrl ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// DELETE /api/settings — remove the org default logo.
export async function DELETE() {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change organisation settings." },
      { status: 403 },
    );
  }

  const { data: org } = await db
    .from("organizations")
    .select("logo_path")
    .eq("id", ctx.orgId)
    .single();

  if (org?.logo_path) {
    await db.storage.from(TEMPLATE_BUCKET).remove([org.logo_path]).catch(() => {});
  }
  const { error } = await db
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "org.logo.delete",
    entity: "organization",
    entity_id: ctx.orgId,
    metadata: {},
  });

  return NextResponse.json({ deleted: true });
}
