// GET /api/templates/[id]/thumb
// Redirects to a short-lived signed URL for the template's FRONT PDF, so the
// browser can render it inline (in an <iframe>/<object>) as a thumbnail without
// any client-side fetch race. RLS scopes the template to the user's org.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();

  const { data: auth } = await db.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: tpl, error } = await db
    .from("templates")
    .select("front_pdf_path")
    .eq("id", params.id)
    .single();
  if (error || !tpl?.front_pdf_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await db.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(tpl.front_pdf_path, 60 * 30);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "could not sign url" }, { status: 500 });
  }

  // Redirect the browser straight to the PDF so the embed renders it natively.
  return NextResponse.redirect(signed.signedUrl, 302);
}
