// GET /api/certificates/[id]/download — stream a single certificate PDF.
// Reprint-safe: always serves the stored PDF from Storage.
// Pass ?inline=1 to render in the browser (Preview) instead of downloading.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { downloadBytes, CERT_BUCKET } from "@/lib/supabase/storage";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const { data: cert, error } = await db
    .from("certificates")
    .select("certificate_number, pdf_path")
    .eq("id", params.id)
    .single();
  if (error || !cert?.pdf_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const bytes = await downloadBytes(db, CERT_BUCKET, cert.pdf_path);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // inline → preview in the browser tab; otherwise force a download.
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${cert.certificate_number}.pdf"`,
    },
  });
}
