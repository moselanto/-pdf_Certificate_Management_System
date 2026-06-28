// ============================================================================
// certBackground — OFFLINE, dependency-free certificate background generator.
//
// Draws distinct, print-ready certificate backgrounds directly onto a pdf-lib
// page (borders, accent rules, corner flourishes, a seal/medallion, palette
// fills). NO external API, NO image bytes, NO per-image cost — pure vector.
//
// Used by both:
//   - the AI helper PREVIEW (render a sample background PDF to show a thumbnail)
//   - "Use this template" (the same artwork becomes the real template front)
// so what the user previews is exactly what they get.
//
// Each STYLE_PRESET is a deterministic recipe keyed by id, so previews and the
// final template are byte-for-byte consistent.
// ============================================================================

import { PDFDocument, rgb, StandardFonts, type PDFPage, type RGB } from "pdf-lib";

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  palette: string[]; // [primary, accent, paper]
}

// Six visually-distinct directions. `palette` is [primary, accent, paper(bg)].
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "navy-gold",
    name: "Classic Navy & Gold",
    description: "A formal double border in navy and gold with corner flourishes and a gold medallion.",
    palette: ["#0B3D67", "#C9A227", "#FFFDF7"],
  },
  {
    id: "minimal-blue",
    name: "Modern Minimal",
    description: "Clean and contemporary: thin accent rules top and bottom, generous white space, a small geometric mark.",
    palette: ["#111827", "#2563EB", "#FFFFFF"],
  },
  {
    id: "emerald-bronze",
    name: "Elegant Emerald",
    description: "Refined emerald and soft bronze frame with delicate corner filigree and a laurel seal.",
    palette: ["#0F766E", "#B08D57", "#FBFBF8"],
  },
  {
    id: "royal-purple",
    name: "Royal Purple Crest",
    description: "Deep purple and gold heraldic frame with a crest medallion and fine corner lines.",
    palette: ["#6D28D9", "#D4AF37", "#FAF7FF"],
  },
  {
    id: "corporate-slate",
    name: "Corporate Slate",
    description: "Professional slate-gray frame with a single sky-blue accent stripe and a shield mark.",
    palette: ["#334155", "#0EA5E9", "#FFFFFF"],
  },
  {
    id: "burgundy-gold",
    name: "Warm Burgundy",
    description: "Traditional burgundy and gold border with scrollwork corners and a circular seal.",
    palette: ["#7F1D1D", "#C9A227", "#FFFBF5"],
  },
];

export function presetById(id: string): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0];
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return rgb(0.1, 0.1, 0.1);
  const int = parseInt(m[1], 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

// Draw a small four-petal flourish centered at (cx, cy) using short lines.
function drawCornerFlourish(page: PDFPage, cx: number, cy: number, color: RGB, size: number) {
  const arms = [
    [0, 0, size, 0],
    [0, 0, 0, size],
    [0, 0, size * 0.7, size * 0.7],
  ];
  for (const [x1, y1, x2, y2] of arms) {
    page.drawLine({
      start: { x: cx + x1, y: cy + y1 },
      end: { x: cx + x2, y: cy + y2 },
      thickness: 1,
      color,
    });
  }
  page.drawCircle({ x: cx, y: cy, size: 2.2, color });
}

/**
 * Draw the full background for a given style onto an existing pdf-lib page.
 * The page should already be the desired size. Coordinates are pdf-lib's
 * native bottom-left origin.
 */
export async function drawCertBackground(
  pdf: PDFDocument,
  page: PDFPage,
  styleId: string,
): Promise<void> {
  const preset = presetById(styleId);
  const [primaryHex, accentHex, paperHex] = preset.palette;
  const primary = hexToRgb(primaryHex);
  const accent = hexToRgb(accentHex);
  const paper = hexToRgb(paperHex);

  const W = page.getWidth();
  const H = page.getHeight();
  const seal = await pdf.embedFont(StandardFonts.HelveticaBold);

  // 1. Paper fill.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });

  // 2. Style-specific framing.
  if (preset.id === "minimal-blue" || preset.id === "corporate-slate") {
    // Minimal/corporate: thin accent rules near top and bottom, no full frame.
    const inset = 40;
    const top = H - 70;
    const bottom = 70;
    page.drawLine({
      start: { x: inset, y: top },
      end: { x: W - inset, y: top },
      thickness: preset.id === "corporate-slate" ? 4 : 2,
      color: accent,
    });
    page.drawLine({
      start: { x: inset, y: bottom },
      end: { x: W - inset, y: bottom },
      thickness: preset.id === "corporate-slate" ? 4 : 2,
      color: primary,
    });
    // Small geometric mark / shield at top center.
    if (preset.id === "corporate-slate") {
      page.drawRectangle({
        x: W / 2 - 16,
        y: H - 58,
        width: 32,
        height: 26,
        borderColor: primary,
        borderWidth: 2,
        color: paper,
      });
    } else {
      page.drawCircle({ x: W / 2, y: H - 44, size: 9, borderColor: accent, borderWidth: 2 });
    }
  } else {
    // Ornate styles: double frame + corner flourishes + seal medallion.
    const outer = 26;
    const inner = 38;
    // Outer frame.
    page.drawRectangle({
      x: outer,
      y: outer,
      width: W - outer * 2,
      height: H - outer * 2,
      borderColor: primary,
      borderWidth: 3,
    });
    // Inner accent frame.
    page.drawRectangle({
      x: inner,
      y: inner,
      width: W - inner * 2,
      height: H - inner * 2,
      borderColor: accent,
      borderWidth: 1.2,
    });
    // Corner flourishes (inside the inner frame).
    const f = 18;
    drawCornerFlourish(page, inner + 6, inner + 6, accent, f); // bottom-left
    drawCornerFlourish(page, W - inner - 6, inner + 6, accent, -f); // bottom-right
    drawCornerFlourish(page, inner + 6, H - inner - 6, accent, f); // top-left (arms up)
    drawCornerFlourish(page, W - inner - 6, H - inner - 6, accent, -f); // top-right

    // Seal medallion at top center: concentric rings + a vector star.
    // NOTE: we draw the star with line segments (NOT a "★" text glyph) because
    // pdf-lib's standard WinAnsi fonts cannot encode U+2605.
    const sx = W / 2;
    const sy = H - 78;
    page.drawCircle({ x: sx, y: sy, size: 26, borderColor: accent, borderWidth: 2.5, color: paper });
    page.drawCircle({ x: sx, y: sy, size: 18, borderColor: primary, borderWidth: 1.2 });
    drawStar(page, sx, sy, 13, accent);
  }
}

/**
 * Draw a filled-looking 5-pointed star centered at (cx, cy) using line
 * segments between the outer points. Avoids any font glyph, so it is safe for
 * pdf-lib's WinAnsi standard fonts.
 */
function drawStar(page: PDFPage, cx: number, cy: number, radius: number, color: RGB) {
  const points: { x: number; y: number }[] = [];
  // Five outer points, starting at the top (-90deg), every 72deg.
  for (let i = 0; i < 5; i++) {
    const angle = (-90 + i * 72) * (Math.PI / 180);
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  // Connect every other point (0->2->4->1->3->0) to form the classic star.
  const order = [0, 2, 4, 1, 3, 0];
  for (let i = 0; i < order.length - 1; i++) {
    const a = points[order[i]];
    const b = points[order[i + 1]];
    page.drawLine({ start: a, end: b, thickness: 1.6, color });
  }
}

/** Convenience: build a single-page background PDF for the given style/size. */
export async function buildBackgroundPdf(
  styleId: string,
  pageW: number,
  pageH: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageW, pageH]);
  await drawCertBackground(pdf, page, styleId);
  return pdf.save();
}
