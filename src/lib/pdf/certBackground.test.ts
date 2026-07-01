import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  STYLE_PRESETS,
  presetById,
  textColorsFor,
  buildBackgroundPdf,
} from "./certBackground";

describe("STYLE_PRESETS", () => {
  it("has at least the nine documented presets, all with unique ids", () => {
    expect(STYLE_PRESETS.length).toBeGreaterThanOrEqual(9);
    const ids = STYLE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a 3-colour [primary, accent, paper] palette of valid hex", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.palette).toHaveLength(3);
      for (const hex of p.palette) {
        expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("includes the three presets added in the polish pass", () => {
    const ids = STYLE_PRESETS.map((p) => p.id);
    expect(ids).toContain("teal-coral");
    expect(ids).toContain("charcoal-amber");
    expect(ids).toContain("forest-cream");
  });
});

describe("presetById", () => {
  it("returns the requested preset", () => {
    expect(presetById("royal-purple").id).toBe("royal-purple");
  });
  it("falls back to the first preset for an unknown id", () => {
    expect(presetById("does-not-exist").id).toBe(STYLE_PRESETS[0].id);
  });
});

describe("textColorsFor", () => {
  it("derives the heading colour from the style's primary", () => {
    const colors = textColorsFor("royal-purple");
    expect(colors.heading).toBe(presetById("royal-purple").palette[0]);
    expect(colors.body).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(colors.muted).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(typeof colors.qrTransparent).toBe("boolean");
  });
});

describe("buildBackgroundPdf", () => {
  // This is the regression guard for the WinAnsi crash: every preset must
  // render WITHOUT throwing (the seal star is drawn with vector lines, not a
  // "★" text glyph that pdf-lib's standard fonts cannot encode).
  it("renders a valid single-page PDF for EVERY preset without throwing", async () => {
    for (const preset of STYLE_PRESETS) {
      const bytes = await buildBackgroundPdf(preset.id, 842, 595);
      expect(bytes.byteLength).toBeGreaterThan(0);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      const page = doc.getPage(0);
      expect(Math.round(page.getWidth())).toBe(842);
      expect(Math.round(page.getHeight())).toBe(595);
    }
  });

  it("renders portrait dimensions when asked", async () => {
    const bytes = await buildBackgroundPdf("navy-gold", 595, 842);
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(595);
    expect(Math.round(page.getHeight())).toBe(842);
  });
});
