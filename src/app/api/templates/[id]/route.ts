// GET    /api/templates/[id]  — single template + a signed front-PDF URL
// PATCH  /api/templates/[id]  — archive / unarchive a template (soft hide).
//                               Body: { "archived": boolean }. Archiving keeps
//                               the template + its certificates intact but hides
//                               it from the active list and the Generate
//                               dropdown. Reversible.
// DELETE /api/templates/[id]  — delete a template, its placeholders, and the
//                               stored PDF files. Blocked if certificates
//                               already reference the template (to preserve
//                               history & reprints) — use archive instead.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: tpl, error } = await db
    .from("templates")
    .select("id, name, front_pdf_path, back_pdf_path, page_width, page_height")
    .eq("id", params.id)
    .single();
  if (error || !tpl) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Short-lived signed URL so the list can render a thumbnail of the front PDF.
  const { data: signed } = await db.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(tpl.front_pdf_path, 60 * 30);

  return NextResponse.json({ template: { ...tpl, frontUrl: signed?.signedUrl ?? null } });
}

// PATCH accepts either an archive toggle, a certificate_title update, or both.
// At least one field must be present. certificate_title is the per-template
// title that fills a "certificate_title" placeholder at generation + preview.
const patchSchema = z
  .object({
    archived: z.boolean().optional(),
    certificate_title: z.string().max(300).nullable().optional(),
  })
  .refine((v) => v.archived !== undefined || v.certificate_title !== undefined, {
    message: "nothing to update",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { archived } = patchSchema.parse(await req.json());
    const { data: tpl } = await db
      .from("templates")
      .select("id, name")
      .eq("id", params.id)
      .single();
    if (!tpl) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { error } = await db
      .from("templates")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", params.id);
    if (error) throw new Error(error.message);

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: archived ? "template.archive" : "template.unarchive",
      entity: "template",
      entity_id: params.id,
      metadata: { name: tpl.name },
    });

    return NextResponse.json({ archived });
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

  // Load the template (RLS scopes to the org) so we know the storage paths.
  const { data: tpl } = await db
    .from("templates")
    .select("id, name, front_pdf_path, back_pdf_path")
    .eq("id", params.id)
    .single();
  if (!tpl) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Guard: don't delete a template that issued certificates (keeps history).
  // Archive it instead (PATCH { archived: true }).
  const { count } = await db
    .from("certificates")
    .select("*", { count: "exact", head: true })
    .eq("template_id", params.id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This template has issued certificates and can't be deleted (history is preserved). Archive it instead to hide it from the active list.",
      },
      { status: 409 },
    );
  }

  // Remove stored PDFs (best-effort), then placeholders, then the row.
  const paths = [tpl.front_pdf_path, tpl.back_pdf_path].filter(Boolean) as string[];
  if (paths.length) {
    await db.storage.from(TEMPLATE_BUCKET).remove(paths).catch(() => {});
  }
  await db.from("placeholders").delete().eq("template_id", params.id);
  const { error: delErr } = await db.from("templates").delete().eq("id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await db.from("audit_logs").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "template.delete",
    entity: "template",
    entity_id: params.id,
    metadata: { name: tpl.name },
  });

  return NextResponse.json({ deleted: true });
}
