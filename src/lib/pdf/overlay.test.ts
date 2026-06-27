import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderCertificate, readTemplatePageSize } from "./overlay";
import type { Placeholder } from "@/lib/domain/types";

// Builds a blank single-page PDF to act as a template fixture.
async function blankTemplate(width = 842, height = 595): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([width, height]);
  return pdf.save();
}

describe("renderCertificate", () => {
  it("overlays text onto the front page and returns a valid PDF", async () => {
    const frontPdf = await blankTemplate();
    const placeholders: Placeholder[] = [
      {
        id: "1",
        page: "front",
        kind: "text",
        fieldKey: "recipient_name",
        label: "Recipient",
        x: 421,
        y: 280,
        fontSize: 28,
        fontFamily: "Helvetica-Bold",
        color: "#111111",
        align: "center",
      },
    ];

    const bytes = await renderCertificate({
      frontPdf,
      placeholders,
      values: { recipient_name: "Jane W. Mwangi" },
    });

    expect(bytes.byteLength).toBeGreaterThan(0);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1);
  });

  it("adds a back page and renders course units when provided", async () => {
    const frontPdf = await blankTemplate();
    const backPdf = await blankTemplate();

    const bytes = await renderCertificate({
      frontPdf,
      backPdf,
      placeholders: [],
      values: {},
      units: [
        { id: "u1", sortOrder: 2, title: "Quality Assurance" },
        { id: "u2", sortOrder: 1, title: "Data Entry Accuracy" },
      ],
      unitsLayout: { x: 72, y: 200 },
    });

    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("skips back placeholders safely when there is no back page", async () => {
    const frontPdf = await blankTemplate();
    const bytes = await renderCertificate({
      frontPdf,
      placeholders: [
        {
          id: "1",
          page: "back",
          kind: "text",
          fieldKey: "note",
          label: "Note",
          x: 10,
          y: 10,
          fontSize: 12,
          fontFamily: "Helvetica",
          color: "#000000",
          align: "left",
        },
      ],
      values: { note: "should be ignored, no back page" },
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1);
  });
});

describe("readTemplatePageSize", () => {
  it("returns the page dimensions in points", async () => {
    const size = await readTemplatePageSize(await blankTemplate(842, 595));
    expect(size.width).toBeCloseTo(842);
    expect(size.height).toBeCloseTo(595);
  });
});
