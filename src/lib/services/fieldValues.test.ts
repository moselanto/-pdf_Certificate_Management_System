import { describe, it, expect } from "vitest";
import { seedStaticTextValues } from "./fieldValues";
import type { Placeholder } from "@/lib/domain/types";

// Minimal Placeholder factory so each case only states the fields under test.
function ph(partial: Partial<Placeholder>): Placeholder {
  return {
    id: "x",
    page: "front",
    kind: "text",
    fieldKey: "f",
    label: "L",
    x: 0,
    y: 0,
    fontSize: 12,
    fontFamily: "Helvetica",
    color: "#111111",
    align: "left",
    ...partial,
  };
}

describe("seedStaticTextValues", () => {
  it("seeds a static text placeholder (certificate_title) from its label", () => {
    // This is the regression guard for the 'title shows in preview but is
    // missing on the generated PDF' bug: generate must seed the label the same
    // way the live preview does (sample[fieldKey] = p.label).
    const values = seedStaticTextValues([
      ph({ fieldKey: "certificate_title", label: "OF MOVING AND HANDLING" }),
    ]);
    expect(values.certificate_title).toBe("OF MOVING AND HANDLING");
  });

  it("does NOT seed dynamic per-recipient fields from their label", () => {
    // recipient_name / issue_date / certificate_number / trainer_name are
    // filled with real values elsewhere; they must stay blank rather than
    // print their label when no value is supplied.
    const values = seedStaticTextValues([
      ph({ fieldKey: "recipient_name", label: "Recipient Name" }),
      ph({ fieldKey: "certificate_number", label: "Certificate No." }),
      ph({ fieldKey: "trainer_name", label: "Trainer Name" }),
      ph({ kind: "date", fieldKey: "issue_date", label: "Issue Date" }),
    ]);
    expect(values.recipient_name).toBeUndefined();
    expect(values.certificate_number).toBeUndefined();
    expect(values.trainer_name).toBeUndefined();
    expect(values.issue_date).toBeUndefined();
  });

  it("ignores non-text placeholders (qr / image / signature / course_list)", () => {
    const values = seedStaticTextValues([
      ph({ kind: "qr", fieldKey: "qr_code", label: "Verification QR" }),
      ph({ kind: "image", fieldKey: "logo", label: "Logo" }),
      ph({ kind: "signature", fieldKey: "trainer_signature", label: "Trainer Signature" }),
      ph({ kind: "course_list", fieldKey: "course_units", label: "Units Covered" }),
    ]);
    expect(Object.keys(values)).toHaveLength(0);
  });

  it("skips a text placeholder with an empty label", () => {
    const values = seedStaticTextValues([
      ph({ fieldKey: "certificate_title", label: "" }),
    ]);
    expect(values.certificate_title).toBeUndefined();
  });
});
