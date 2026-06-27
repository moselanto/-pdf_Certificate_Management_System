// ============================================================================
// Bulk generation — loops the single-certificate service over many rows,
// collecting per-row results and errors so one bad row never fails the batch.
//
// Reuses generateCertificate() verbatim (no duplicated logic). For very large
// batches this should run in a queue/worker; the function is written so it can
// be lifted into one unchanged. We process sequentially to keep memory bounded
// and avoid Storage/DB rate spikes; a small concurrency limit can be added if
// throughput becomes the bottleneck.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCertificate } from "@/lib/services/generateCertificate";
import { applyMapping, type FieldMapping } from "./parse";

export interface BatchRowInput {
  /** 1-based row number from the spreadsheet, for error reporting. */
  rowNumber: number;
  row: Record<string, string>;
}

export interface BatchItemResult {
  rowNumber: number;
  recipientName: string;
  ok: boolean;
  certificateId?: string;
  certificateNumber?: string;
  /** PDF bytes kept in-memory only when collectPdfs is true (for ZIP). */
  pdfBytes?: Uint8Array;
  error?: string;
}

export interface BatchOptions {
  orgId: string;
  templateId: string;
  courseId?: string;
  trainerId?: string;
  mapping: FieldMapping;
  defaultIssueDate: string; // ISO, used when a row has no issue_date
  createdBy?: string;
  /** Keep rendered PDF bytes in the results for ZIP packaging. */
  collectPdfs?: boolean;
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchItemResult[];
}

export async function generateBatch(
  db: SupabaseClient,
  rows: BatchRowInput[],
  opts: BatchOptions,
): Promise<BatchSummary> {
  const results: BatchItemResult[] = [];

  for (const { rowNumber, row } of rows) {
    const { recipientName, issueDate, values } = applyMapping(row, opts.mapping);

    if (!recipientName) {
      results.push({
        rowNumber,
        recipientName: "",
        ok: false,
        error: "missing recipient name",
      });
      continue;
    }

    try {
      const res = await generateCertificate(db, {
        orgId: opts.orgId,
        createdBy: opts.createdBy,
        templateId: opts.templateId,
        courseId: opts.courseId,
        trainerId: opts.trainerId,
        recipientName,
        issueDate: normalizeDate(issueDate) ?? opts.defaultIssueDate,
        values,
      });
      results.push({
        rowNumber,
        recipientName,
        ok: true,
        certificateId: res.certificateId,
        certificateNumber: res.certificateNumber,
        pdfBytes: opts.collectPdfs ? res.pdfBytes : undefined,
      });
    } catch (e) {
      results.push({
        rowNumber,
        recipientName,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return {
    total: rows.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

/** Accepts common spreadsheet date strings; returns ISO yyyy-mm-dd or null. */
function normalizeDate(input?: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
