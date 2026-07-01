// ============================================================================
// ZIP packaging — bundle a batch of generated certificate PDFs into a single
// downloadable archive using jszip. Filenames use the certificate number so
// they are unique and meaningful.
// ============================================================================

import JSZip from "jszip";
import type { BatchItemResult } from "./generateBatch";

/**
 * Build a ZIP archive (as bytes) from successful batch results that carry
 * pdfBytes. Also writes a results.csv manifest so the admin can reconcile
 * which rows succeeded or failed.
 */
export async function buildBatchZip(
  results: BatchItemResult[],
): Promise<Uint8Array> {
  const zip = new JSZip();
  const folder = zip.folder("certificates")!;

  for (const r of results) {
    if (r.ok && r.pdfBytes && r.certificateNumber) {
      folder.file(`${r.certificateNumber}.pdf`, r.pdfBytes);
    }
  }

  zip.file("results.csv", buildManifestCsv(results));

  const content = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return content;
}

function buildManifestCsv(results: BatchItemResult[]): string {
  const header = "row,recipient_name,status,certificate_number,error";
  const lines = results.map((r) =>
    [
      r.rowNumber,
      csvCell(r.recipientName),
      r.ok ? "generated" : "failed",
      r.certificateNumber ?? "",
      csvCell(r.error ?? ""),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
