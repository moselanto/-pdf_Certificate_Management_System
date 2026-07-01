// GET /api/fonts/:id/file — stream a custom font's bytes for the browser.
//
// The template designer loads custom uploaded fonts into the page via the
// FontFace API so field/design text previews in the chosen font on the canvas
// (not only in the server-rendered preview). This route serves the stored font
// file, scoped to the caller's org via RLS on the `fonts` table.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { downloadTemplate } from "@/lib/supabase/storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();

  // Require an authenticated user; RLS on `fonts` restricts the row to the
  // caller's org, so a font id from another org simply won't be found.
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: font, error } = await db
    .from("fonts")
    .select("file_path")
    .eq("id", params.id)
    .single();
  if (error || !font?.file_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const bytes = await downloadTemplate(db, font.file_path);
    const isOtf = font.file_path.toLowerCase().endsWith(".otf");
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": isOtf ? "font/otf" : "font/ttf",
        // Immutable content keyed by id; cache aggressively in the browser.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "download failed" }, { status: 502 });
  }
}
