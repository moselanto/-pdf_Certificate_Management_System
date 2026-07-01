// ============================================================================
// fieldValues — pure helpers for assembling the per-certificate field values
// map that the PDF engine draws via values[fieldKey].
//
// Kept dependency-free (types only) so it is trivially unit-testable and shared
// by the generate service. The live preview (TemplateDesigner) builds the same
// shape client-side; this mirrors its behaviour on the server so a certificate
// GENERATES identically to how it PREVIEWS.
// ============================================================================

import type { Placeholder } from "@/lib/domain/types";

/**
 * Field keys that are filled per-recipient at generation time (recipient name,
 * issue date, certificate number, trainer name). These must NEVER fall back to
 * printing their placeholder label — if no value is supplied they stay blank,
 * exactly as the live preview special-cases them. Without this guard, a cert
 * generated without a trainer would print the literal label "Trainer Name".
 */
export const DYNAMIC_FIELD_KEYS: ReadonlySet<string> = new Set([
  "recipient_name",
  "issue_date",
  "certificate_number",
  "trainer_name",
]);

/**
 * Seed printed values for STATIC text placeholders from their label.
 *
 * A static text field prints the same wording on every certificate from a
 * template — e.g. a "certificate_title" field whose label is
 * "OF MOVING AND HANDLING". That wording lives in the placeholder's `label`
 * (for a text field the Label IS the printed text — see FieldInspector). The
 * PDF engine only draws text through values[fieldKey], so unless we seed the
 * label into the values map the title is BLANK on the generated PDF even though
 * it shows in the live preview (the preview seeds label the same way via
 * `sample[fieldKey] = p.label`).
 *
 * Only `text` placeholders are seeded, and never the dynamic per-recipient keys
 * (see DYNAMIC_FIELD_KEYS) — those are filled with real values elsewhere and
 * must stay blank rather than print their label when no value exists. The
 * returned defaults are intended to be spread BEFORE the real/dynamic values so
 * genuine values and caller overrides always take precedence.
 */
export function seedStaticTextValues(
  placeholders: ReadonlyArray<Pick<Placeholder, "kind" | "fieldKey" | "label">>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of placeholders) {
    if (p.kind === "text" && p.label && !DYNAMIC_FIELD_KEYS.has(p.fieldKey)) {
      out[p.fieldKey] = p.label;
    }
  }
  return out;
}
