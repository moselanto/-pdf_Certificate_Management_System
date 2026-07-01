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

// --- Regression guards for the WinAnsi bullet crash --------------------------
// pdf-lib's standard WinAnsi fonts cannot encode U+2022 ("•"). The engine uses
// a "-  " marker on all three course-list paths. These tests render a course
// list down each path and assert no throw + a valid 2-page PDF.
describe("renderCertificate — course-list paths are WinAnsi-safe", () => {
  const units = [
    { id: "u1", sortOrder: 1, title: "Data Entry Accuracy" },
    { id: "u2", sortOrder: 2, title: "Quality Assurance" },
    { id: "u3", sortOrder: 3, title: "A very long unit title that should wrap across the available width nicely" },
  ];

  it("auto-created back page (no back PDF) renders the centered list", async () => {
    const frontPdf = await blankTemplate();
    const bytes = await renderCertificate({
      frontPdf,
      placeholders: [],
      values: {},
      units,
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("designer-placed course_list box renders the list at its position", async () => {
    const frontPdf = await blankTemplate();
    const backPdf = await blankTemplate();
    const placeholders: Placeholder[] = [
      {
        id: "cl",
        page: "back",
        kind: "course_list",
        fieldKey: "course_units",
        label: "Units Covered",
        x: 421,
        y: 150,
        width: 400,
        fontSize: 16,
        fontFamily: "Helvetica",
        color: "#222222",
        align: "center",
      },
    ];
    const bytes = await renderCertificate({ frontPdf, backPdf, placeholders, values: {}, units });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("user-supplied back design uses the fixed layout without throwing", async () => {
    const frontPdf = await blankTemplate();
    const backPdf = await blankTemplate();
    const bytes = await renderCertificate({
      frontPdf,
      backPdf,
      placeholders: [],
      values: {},
      units,
      unitsLayout: { x: 72, y: 200, fontSize: 12, lineGap: 8 },
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });
});

// --- Aspect-lock image placeholder ------------------------------------------
describe("renderCertificate — image placeholders", () => {
  // A 1x1 transparent PNG (valid, embeddable by pdf-lib).
  const onePxPng = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    ),
    (c) => c.charCodeAt(0),
  );

  it("renders an aspect-locked image without throwing", async () => {
    const frontPdf = await blankTemplate();
    const placeholders: Placeholder[] = [
      {
        id: "logo",
        page: "front",
        kind: "image",
        fieldKey: "logo",
        label: "Logo",
        x: 100,
        y: 100,
        width: 120,
        height: 60,
        fontSize: 12,
        fontFamily: "Helvetica",
        color: "#000000",
        align: "left",
        lockAspect: true,
      },
    ];
    const bytes = await renderCertificate({
      frontPdf,
      placeholders,
      values: {},
      images: { logo: onePxPng },
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1);
  });
});

// --- Custom font fallback ----------------------------------------------------
describe("renderCertificate — custom fonts", () => {
  it("falls back to a standard font when the custom font bytes are invalid", async () => {
    const frontPdf = await blankTemplate();
    const placeholders: Placeholder[] = [
      {
        id: "1",
        page: "front",
        kind: "text",
        fieldKey: "recipient_name",
        label: "Recipient",
        x: 100,
        y: 100,
        fontSize: 24,
        fontFamily: "Great Vibes",
        color: "#111111",
        align: "left",
      },
    ];
    // Garbage bytes for the referenced family — the engine must NOT throw; it
    // should fall back to a standard font so a bad upload never fails a render.
    const bytes = await renderCertificate({
      frontPdf,
      placeholders,
      values: { recipient_name: "Jane W. Mwangi" },
      customFonts: { "Great Vibes": new Uint8Array([0, 1, 2, 3, 4]) },
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1);
  });
});

// --- Grouped course content (sections + vector checkmarks) ------------------
// Units may carry an optional `section` so the back page groups them under bold
// sub-headings, each with its own checkmark list. These assert no throw + a
// valid 2-page PDF down each of the three course-list paths, and that a plain
// (sectionless) list still renders.
describe("renderCertificate — grouped course content", () => {
  const groupedUnits = [
    { id: "u1", sortOrder: 0, title: "Duty of Care", section: "Theory" },
    { id: "u2", sortOrder: 1, title: "Safeguarding Adults and Children", section: "Theory" },
    { id: "u3", sortOrder: 2, title: "Basic Life Support", section: "Practical" },
    { id: "u4", sortOrder: 3, title: "Moving and Handling", section: "Practical" },
  ];

  it("renders grouped sections in a placed course_list box", async () => {
    const frontPdf = await blankTemplate();
    const backPdf = await blankTemplate();
    const placeholders: Placeholder[] = [
      {
        id: "cl",
        page: "back",
        kind: "course_list",
        fieldKey: "course_units",
        label: "Course Content",
        x: 421,
        y: 120,
        width: 500,
        fontSize: 14,
        fontFamily: "Helvetica",
        color: "#123456",
        align: "center",
      },
    ];
    const bytes = await renderCertificate({ frontPdf, backPdf, placeholders, values: {}, units: groupedUnits });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("renders grouped sections on an auto-created back page", async () => {
    const frontPdf = await blankTemplate();
    const bytes = await renderCertificate({ frontPdf, placeholders: [], values: {}, units: groupedUnits });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("renders grouped sections on a user-supplied fixed layout", async () => {
    const frontPdf = await blankTemplate();
    const backPdf = await blankTemplate();
    const bytes = await renderCertificate({
      frontPdf,
      backPdf,
      placeholders: [],
      values: {},
      units: groupedUnits,
      unitsLayout: { x: 72, y: 200, fontSize: 12 },
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("still renders a plain checklist when no unit has a section", async () => {
    const frontPdf = await blankTemplate();
    const backPdf = await blankTemplate();
    const bytes = await renderCertificate({
      frontPdf,
      backPdf,
      placeholders: [],
      values: {},
      units: [{ id: "u1", sortOrder: 0, title: "Use of full body hoist" }],
      unitsLayout: { x: 72, y: 200, fontSize: 12 },
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });
});
