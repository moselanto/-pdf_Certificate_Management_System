// POST /api/bulk/generate — multipart upload of the spreadsheet + a JSON
// "config" field describing the mapping and chosen template/course/trainer.
// Generates every row (reusing the single-cert service), persists each
// certificate, and streams back a ZIP of all PDFs plus a results.csv manifest.
//
// Form fields:
//   file    (File)   the .xlsx/.xls/.csv
//   config  (string) JSON: { templateId, courseId?, trainerId?, mapping, issueDate }
//
// For very large imports this should move to a background job; see ROADMAP.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSpreadsheet } from "@/lib/bulk/parse";
import { generateBatch } from "@/lib/bulk/generateBatch";
import { buildBatchZip } from "@/lib/bulk/zip";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300; // allow longer for sizeable batches

const configSchema = z.object({
  templateId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  trainerId: z.string().uuid().optional(),
  mapping: z.record(z.string()),
  issueDate: z.string(), // default ISO date for rows without their own
});

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

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const configRaw = form.get("config");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (typeof configRaw !== "string") {
      return NextResponse.json({ error: "config is required" }, { status: 400 });
    }
    const config = configSchema.parse(JSON.parse(configRaw));

    // recipient_name mapping is mandatory.
    if (!config.mapping.recipient_name) {
      return NextResponse.json(
        { error: "you must map a column to the recipient name" },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { rows } = parseSpreadsheet(bytes);
    if (rows.length === 0) {
      return NextResponse.json({ error: "no data rows found" }, { status: 400 });
    }

    const summary = await generateBatch(
      db,
      rows.map((row, i) => ({ rowNumber: i + 2, row })), // +2: header is row 1
      {
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        templateId: config.templateId,
        courseId: config.courseId,
        trainerId: config.trainerId,
        mapping: config.mapping,
        defaultIssueDate: config.issueDate,
        collectPdfs: true,
      },
    );

    // Audit the batch as a whole.
    await db.from("audit_logs").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action: "certificate.bulk_generate",
      entity: "certificate",
      metadata: {
        total: summary.total,
        succeeded: summary.succeeded,
        failed: summary.failed,
      },
    });

    const zipBytes = await buildBatchZip(summary.results);

    return new NextResponse(Buffer.from(zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="certificates-${Date.now()}.zip"`,
        // Surface batch stats without forcing the client to open the ZIP.
        "X-Batch-Total": String(summary.total),
        "X-Batch-Succeeded": String(summary.succeeded),
        "X-Batch-Failed": String(summary.failed),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
