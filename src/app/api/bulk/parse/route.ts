// POST /api/bulk/parse — multipart upload of an .xlsx/.xls/.csv file.
// Returns headers + a small preview of rows so the UI can build a column->field
// mapping. Does NOT generate anything. Capped preview keeps the response light.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSpreadsheet, MAPPABLE_FIELDS } from "@/lib/bulk/parse";

export const runtime = "nodejs";

const MAX_ROWS = 2000;

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { headers, rows } = parseSpreadsheet(bytes);

    if (headers.length === 0) {
      return NextResponse.json({ error: "could not read any columns" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `too many rows (${rows.length}). Max ${MAX_ROWS} per import.` },
        { status: 400 },
      );
    }

    // Suggest a mapping by fuzzy-matching headers to known field keys.
    const suggested: Record<string, string> = {};
    for (const field of MAPPABLE_FIELDS) {
      const match = headers.find(
        (h) =>
          h.toLowerCase().replace(/[\s_-]/g, "") ===
          field.key.replace(/[\s_-]/g, ""),
      );
      if (match) suggested[field.key] = match;
    }

    return NextResponse.json({
      headers,
      rowCount: rows.length,
      preview: rows.slice(0, 5),
      fields: MAPPABLE_FIELDS,
      suggestedMapping: suggested,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
