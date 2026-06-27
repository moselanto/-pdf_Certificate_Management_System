// ============================================================================
// CertForge PDF overlay engine — PURE & framework-agnostic.
//
// Takes an uploaded template PDF (front + optional back) and overlays text,
// QR codes, signatures/images, and a course-units list, preserving the
// original design (we draw on top of the existing pages, never re-encode them).
//
// Coordinate convention:
//   Placeholders use a TOP-LEFT origin (matches the browser editor).
//   pdf-lib uses a BOTTOM-LEFT origin. We convert with: pdfY = pageHeight - y.
// ============================================================================

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { Placeholder, RenderInput } from "@/lib/domain/types";

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return rgb(0.07, 0.07, 0.07);
  const int = parseInt(m[1], 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

// Map our font names to pdf-lib standard fonts. Custom fonts can be embedded
// later via fontkit; standard fonts keep the bundle lean and deterministic.
function standardFontFor(family: string): StandardFonts {
  const f = family.toLowerCase();
  if (f.includes("times")) return StandardFonts.TimesRoman;
  if (f.includes("courier")) return StandardFonts.Courier;
  if (f.includes("bold")) return StandardFonts.HelveticaBold;
  return StandardFonts.Helvetica;
}

function drawAlignedText(
  page: PDFPage,
  text: string,
  ph: Placeholder,
  font: PDFFont,
) {
  const size = ph.fontSize;
  const color = hexToRgb(ph.color);
  const textWidth = font.widthOfTextAtSize(text, size);
  const pageHeight = page.getHeight();

  let x = ph.x;
  if (ph.align === "center") x = ph.x - textWidth / 2;
  else if (ph.align === "right") x = ph.x - textWidth;

  // Convert top-left origin to pdf-lib bottom-left; y marks the text baseline.
  const y = pageHeight - ph.y - size;

  page.drawText(text, { x, y, size, font, color });
}

async function drawImage(
  pdf: PDFDocument,
  page: PDFPage,
  bytes: Uint8Array,
  ph: Placeholder,
) {
  // QR & signatures are PNG; embed and place within the placeholder box.
  const img = await pdf.embedPng(bytes);
  const w = ph.width ?? 96;
  const h = ph.height ?? w;
  const pageHeight = page.getHeight();
  const y = pageHeight - ph.y - h;
  page.drawImage(img, { x: ph.x, y, width: w, height: h });
}

/**
 * Render a certificate PDF from a template + values.
 * Returns the finished PDF as bytes (ready to upload or stream for download).
 */
export async function renderCertificate(input: RenderInput): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  // --- FRONT ---------------------------------------------------------------
  const frontSrc = await PDFDocument.load(input.frontPdf);
  const [frontPage] = await out.copyPages(frontSrc, [0]);
  out.addPage(frontPage);

  // --- BACK (optional) -----------------------------------------------------
  let backPage: PDFPage | undefined;
  if (input.backPdf) {
    const backSrc = await PDFDocument.load(input.backPdf);
    const [bp] = await out.copyPages(backSrc, [0]);
    backPage = out.addPage(bp);
  }

  const fontCache = new Map<StandardFonts, PDFFont>();
  const getFont = async (family: string) => {
    const key = standardFontFor(family);
    if (!fontCache.has(key)) fontCache.set(key, await out.embedFont(key));
    return fontCache.get(key)!;
  };

  // --- Placeholders --------------------------------------------------------
  for (const ph of input.placeholders) {
    const page = ph.page === "back" ? backPage : frontPage;
    if (!page) continue; // back placeholder but no back page — skip safely

    if (ph.kind === "qr" || ph.kind === "image" || ph.kind === "signature") {
      const bytes = input.images?.[ph.fieldKey];
      if (bytes) await drawImage(out, page, bytes, ph);
      continue;
    }

    // text / date
    const value = input.values[ph.fieldKey];
    if (value === undefined || value === "") continue;
    const font = await getFont(ph.fontFamily);
    drawAlignedText(page, value, ph, font);
  }

  // --- Dynamic course units on the back page -------------------------------
  if (input.units?.length && backPage) {
    const layout = input.unitsLayout ?? { x: 72, y: 200 };
    const size = layout.fontSize ?? 12;
    const gap = layout.lineGap ?? 6;
    const bullet = layout.bullet ?? "•  ";
    const color = hexToRgb(layout.color ?? "#222222");
    const font = await getFont("Helvetica");
    const pageHeight = backPage.getHeight();

    const sorted = [...input.units].sort((a, b) => a.sortOrder - b.sortOrder);
    sorted.forEach((unit, i) => {
      const lineY = pageHeight - layout.y - i * (size + gap) - size;
      backPage!.drawText(`${bullet}${unit.title}`, {
        x: layout.x,
        y: lineY,
        size,
        font,
        color,
      });
    });
  }

  return out.save();
}

/** Capture a template's page size (used by the editor to scale the canvas). */
export async function readTemplatePageSize(
  pdfBytes: Uint8Array,
): Promise<{ width: number; height: number }> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);
  return { width: page.getWidth(), height: page.getHeight() };
}
