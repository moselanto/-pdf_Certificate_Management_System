import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  renderCertificate,
  readTemplatePageSize,
  measureCourseContent,
  fitCourseContentSize,
  centerBlockTop,
} from "./overlay";
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

// --- Auto-fit: wrapping + shrink-to-fit -------------------------------------
// A long course list must WRAP (headings and items) and SHRINK its font so it
// always sits inside the frame instead of spilling off the edge / bottom.
describe("course content auto-fit (measure + shrink-to-fit)", () => {
  async function makeFonts() {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    return { font, headingFont };
  }

  const manyUnits = Array.from({ length: 24 }, (_, i) => ({
    id: `u${i}`,
    sortOrder: i,
    title: `Competency number ${i + 1} covering an important care topic`,
  }));

  it("measured height grows as more units are added", async () => {
    const { font, headingFont } = await makeFonts();
    const base = {
      anchorX: 300,
      align: "center" as const,
      topY: 0,
      maxWidth: 400,
      color: rgb(0.1, 0.1, 0.1),
      font,
      headingFont,
    };
    const few = measureCourseContent(manyUnits.slice(0, 3), { ...base, size: 14 });
    const lots = measureCourseContent(manyUnits, { ...base, size: 14 });
    expect(lots).toBeGreaterThan(few);
  });

  it("returns the max size when there is ample room, and shrinks when tight", async () => {
    const { font, headingFont } = await makeFonts();
    const base = {
      anchorX: 300,
      align: "center" as const,
      topY: 0,
      maxWidth: 400,
      color: rgb(0.1, 0.1, 0.1),
      font,
      headingFont,
    };
    const roomy = fitCourseContentSize(manyUnits, base, 26, 7, 100000);
    const tight = fitCourseContentSize(manyUnits, base, 26, 7, 220);
    expect(roomy).toBe(26);
    expect(tight).toBeLessThan(roomy);
    expect(tight).toBeGreaterThanOrEqual(7);
  });

  it("wraps long items so a long title measures taller than a short one", async () => {
    const { font, headingFont } = await makeFonts();
    const base = {
      anchorX: 300,
      align: "left" as const,
      topY: 0,
      maxWidth: 200,
      color: rgb(0, 0, 0),
      font,
      headingFont,
      size: 14,
    };
    const shortItem = measureCourseContent(
      [{ id: "a", sortOrder: 0, title: "Short" }],
      base,
    );
    const longItem = measureCourseContent(
      [
        {
          id: "b",
          sortOrder: 0,
          title:
            "A very long unit title that certainly wraps across a narrow column width",
        },
      ],
      base,
    );
    expect(longItem).toBeGreaterThan(shortItem);
  });

  it("wraps long section headings too", async () => {
    const { font, headingFont } = await makeFonts();
    const base = {
      anchorX: 300,
      align: "center" as const,
      topY: 0,
      maxWidth: 160,
      color: rgb(0, 0, 0),
      font,
      headingFont,
      size: 14,
    };
    const shortHeading = measureCourseContent(
      [{ id: "a", sortOrder: 0, title: "Item", section: "Theory" }],
      base,
    );
    const longHeading = measureCourseContent(
      [
        {
          id: "b",
          sortOrder: 0,
          title: "Item",
          section:
            "A Very Long Section Heading That Must Wrap Across Several Lines Here",
        },
      ],
      base,
    );
    expect(longHeading).toBeGreaterThan(shortHeading);
  });

  it("renders a long list in a small placed box on a single back page", async () => {
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
        height: 360,
        fontSize: 18,
        fontFamily: "Helvetica",
        color: "#123456",
        align: "center",
      },
    ];
    const bytes = await renderCertificate({
      frontPdf,
      backPdf,
      placeholders,
      values: {},
      units: manyUnits,
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
  });
});

// --- Vertical centering of the course-content block -------------------------
describe("centerBlockTop (vertical centering, clamped to margins)", () => {
  const pageHeight = 595;
  const topMargin = 40;
  const bottomMargin = 40;

  it("centers a block on the given center point", () => {
    const totalHeight = 200;
    const top = centerBlockTop(
      pageHeight / 2,
      totalHeight,
      pageHeight,
      topMargin,
      bottomMargin,
    );
    expect(top).toBeCloseTo(pageHeight / 2 - totalHeight / 2);
  });

  it("clamps to the top margin when the center is too high", () => {
    const top = centerBlockTop(10, 200, pageHeight, topMargin, bottomMargin);
    expect(top).toBe(topMargin);
  });

  it("clamps to the bottom when the center is too low", () => {
    const totalHeight = 200;
    const top = centerBlockTop(
      pageHeight - 5,
      totalHeight,
      pageHeight,
      topMargin,
      bottomMargin,
    );
    expect(top).toBe(pageHeight - bottomMargin - totalHeight);
  });

  it("falls back to the top margin when the block is taller than the usable page", () => {
    const top = centerBlockTop(
      pageHeight / 2,
      pageHeight,
      pageHeight,
      topMargin,
      bottomMargin,
    );
    expect(top).toBe(topMargin);
  });
});
