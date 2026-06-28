// GET  /api/templates           — list templates for the user's org
// POST /api/templates           — create a template by uploading front/back PDFs
//
// The POST accepts multipart/form-data:
//   name        (string)  required
//   front       (File)    required — the reusable front PDF background
//   back        (File)    optional — the reusable back PDF background
//
// On upload we capture the page size (points) from the front PDF so the
// drag-and-drop editor can scale its canvas exactly to the printed page.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readTemplatePageSize } from "@/lib/pdf/overlay";
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

export async function GET() {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await db
    .from("templates")
    .select("id, name, front_pdf_path, back_pdf_path, page_width, page_height, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ templates: data });
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
    const name = String(form.get("name") ?? "").trim();
    const front = form.get("front");
    const back = form.get("back");

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!(front instanceof File)) {
      return NextResponse.json({ error: "front PDF is required" }, { status: 400 });
    }
    if (front.type !== "application/pdf") {
      return NextResponse.json({ error: "front must be a PDF" }, { status: 400 });
    }

    const frontBytes = new Uint8Array(await front.arrayBuffer());
    const { width, height } = await readTemplatePageSize(frontBytes);

    const stamp = Date.now();
    const frontPath = `${ctx.orgId}/${stamp}-front.pdf`;
    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(frontPath, frontBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`front upload failed: ${upErr.message}`);

    let backPath: string | null = null;
    if (back instanceof File && back.size > 0) {
      if (back.type !== "application/pdf") {
        return NextResponse.json({ error: "back must be a PDF" }, { status: 400 });
      }
      const backBytes = new Uint8Array(await back.arrayBuffer());
      backPath = `${ctx.orgId}/${stamp}-back.pdf`;
      const { error: bErr } = await db.storage
        .from(TEMPLATE_BUCKET)
        .upload(backPath, backBytes, { contentType: "application/pdf", upsert: false });
      if (bErr) throw new Error(`back upload failed: ${bErr.message}`);
    }

    const { data: tpl, error: insErr } = await db
      .from("templates")
      .insert({
        org_id: ctx.orgId,
        name,
        front_pdf_path: frontPath,
        back_pdf_path: backPath,
        page_width: width,
        page_height: height,
      })
      .select("id")
      .single();
    if (insErr || !tpl) throw new Error(`create failed: ${insErr?.message}`);

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "template.create",
      entity: "template",
      entity_id: tpl.id,
      metadata: { name },
    });

    return NextResponse.json({ id: tpl.id, pageWidth: width, pageHeight: height });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
