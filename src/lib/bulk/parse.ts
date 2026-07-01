// ============================================================================
// Bulk import parsing — turns an uploaded Excel/CSV file into normalized rows.
//
// We read the first sheet, treat the first row as headers, and return both the
// raw header list (so the UI can offer column->field mapping) and the data
// rows as objects keyed by header. Header keys are trimmed but otherwise
// preserved so the mapping UI shows what the admin actually uploaded.
// ============================================================================

import * as XLSX from "xlsx";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parse the first worksheet of an .xlsx/.xls/.csv file (given as bytes). */
export function parseSpreadsheet(bytes: Uint8Array): ParsedSheet {
  const wb = XLSX.read(bytes, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const sheet = wb.Sheets[firstSheetName];
  // defval:"" keeps every column present even when a cell is blank.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false, // format dates/numbers as strings as they appear
  });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = Object.keys(raw[0]).map((h) => h.trim());
  const rows = raw.map((r) => {
    const obj: Record<string, string> = {};
    for (const key of Object.keys(r)) {
      obj[key.trim()] = String(r[key] ?? "").trim();
    }
    return obj;
  });

  return { headers, rows };
}

// The canonical certificate fields a column can map onto. `recipient_name` is
// the only required mapping; everything else is optional and flows into the
// certificate's field_values for the template placeholders to consume.
export const MAPPABLE_FIELDS = [
  { key: "recipient_name", label: "Recipient name", required: true },
  { key: "issue_date", label: "Issue date", required: false },
  { key: "trainer_name", label: "Trainer name", required: false },
  { key: "certificate_title", label: "Certificate title", required: false },
] as const;

export type FieldMapping = Record<string, string>; // fieldKey -> header

/**
 * Apply a column mapping to a parsed row, producing the recipientName, optional
 * issueDate, and a values bag for any other mapped/extra fields.
 */
export function applyMapping(
  row: Record<string, string>,
  mapping: FieldMapping,
): { recipientName: string; issueDate?: string; values: Record<string, string> } {
  const values: Record<string, string> = {};
  let recipientName = "";
  let issueDate: string | undefined;

  for (const [fieldKey, header] of Object.entries(mapping)) {
    if (!header) continue;
    const cell = row[header] ?? "";
    if (fieldKey === "recipient_name") recipientName = cell;
    else if (fieldKey === "issue_date") issueDate = cell || undefined;
    else if (cell) values[fieldKey] = cell;
  }

  return { recipientName, issueDate, values };
}
