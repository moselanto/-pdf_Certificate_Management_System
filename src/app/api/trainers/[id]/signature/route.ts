// POST /api/trainers/[id]/signature — upload a trainer's signature PNG.
//
// The signature is stored in the template bucket (re-used as a general org
// asset bucket) and its path written to trainers.signature_path. The PDF
// engine embeds this PNG wherever a placeholder of kind "signature" exists.
//
// We require a transparent PNG so it sits cleanly over the certificate.

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

  // Confirm the trainer exists in this org (RLS already scopes the select).
  const { data: trainer } = await db
    .from("trainers")
    .select("id")
    .eq("id", params.id)
    .single();
  if (!trainer) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get("signature");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "signature file is required" }, { status: 400 });
    }
    if (file.type !== "image/png") {
      return NextResponse.json(
        { error: "signature must be a PNG (transparent background recommended)" },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${ctx.orgId}/signatures/${params.id}.png`;
    const { error: upErr } = await db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    const { error: updErr } = await db
      .from("trainers")
      .update({ signature_path: path })
      .eq("id", params.id);
    if (updErr) throw new Error(`update failed: ${updErr.message}`);

    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "trainer.signature_upload",
      entity: "trainer",
      entity_id: params.id,
      metadata: {},
    });

    return NextResponse.json({ signaturePath: path });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
