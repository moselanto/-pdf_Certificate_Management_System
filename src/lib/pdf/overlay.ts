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
//
// SIGNATURE: a "signature" placeholder renders EITHER an uploaded signature
// image (PNG) when one is provided in input.images, OR a typed signature as
// styled text (from input.values) when no image exists. This lets a trainer
// use a scanned/drawn signature or simply a typed name.
//
// COURSE UNITS / BACK PAGE: when course units are provided we draw them on the
// back page. If the template has no back page, we AUTO-CREATE a clean back page
// (matching the front page size) with a "Course Units" heading so the course
// content is never silently dropped. This fixes certificates that need a course
// list on the back but were uploaded as a front-only template.
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
  if (f.includes("oblique") || f.includes("italic")) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

function drawAlignedText(
  page: PDFPage,
  text: string,
  ph: Placeholder,
  font: PDFFont,
  fontSizeOverride?: number,
) {
  const size = fontSizeOverride ?? ph.fontSize;
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

// Greedy word-wrap: split `text` into lines that each fit within `maxWidth`
// points at the given font/size. Used for the course-list box when the user
// sets a width, so long unit titles wrap instead of overflowing the page.
function wrapToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

async function drawImage(
  pdf: PDFDocument,
  page: PDFPage,
  bytes: Uint8Array,
  ph: Placeholder,
) {
  // QR & signatures are PNG; logos may be PNG or JPEG. Try PNG first, fall back
  // to JPEG so an uploaded JPEG logo still renders (embedPng throws on JPEG).
  let img;
  try {
    img = await pdf.embedPng(bytes);
  } catch {
    img = await pdf.embedJpg(bytes);
  }

  const boxW = ph.width ?? 96;
  const boxH = ph.height ?? boxW;
  const pageHeight = page.getHeight();

  if (ph.lockAspect) {
    // "contain" the image inside the box, preserving its intrinsic aspect ratio,
    // and center it. Avoids stretching a logo/signature that isn't the same
    // proportion as the placeholder box.
    const scale = Math.min(boxW / img.width, boxH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = (boxW - drawW) / 2;
    const offsetY = (boxH - drawH) / 2;
    const y = pageHeight - ph.y - boxH + offsetY;
    page.drawImage(img, { x: ph.x + offsetX, y, width: drawW, height: drawH });
    return;
  }

  // Default: stretch to fill the box exactly (original behaviour).
  const y = pageHeight - ph.y - boxH;
  page.drawImage(img, { x: ph.x, y, width: boxW, height: boxH });
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
  const frontWidth = frontPage.getWidth();
  const frontHeight = frontPage.getHeight();

  // --- BACK (optional) -----------------------------------------------------
  let backPage: PDFPage | undefined;
  let backWasAutoCreated = false;
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

  // If we have course units to show but NO back page, create a clean one that
  // matches the front page size so the course content always renders.
  if (input.units?.length && !backPage) {
    backPage = out.addPage([frontWidth, frontHeight]);
    backWasAutoCreated = true;
  }

  // --- Placeholders --------------------------------------------------------
  for (const ph of input.placeholders) {
    const page = ph.page === "back" ? backPage : frontPage;
    if (!page) continue; // back placeholder but no back page — skip safely

    if (ph.kind === "qr" || ph.kind === "image") {
      const bytes = input.images?.[ph.fieldKey];
      if (bytes) await drawImage(out, page, bytes, ph);
      continue;
    }

    if (ph.kind === "signature") {
      // Prefer an uploaded signature image; otherwise fall back to a typed
      // signature rendered in an italic/script-like standard font.
      const bytes = input.images?.[ph.fieldKey];
      if (bytes) {
        await drawImage(out, page, bytes, ph);
      } else {
        const typed = input.values[ph.fieldKey];
        if (typed) {
          const font = await getFont("Helvetica-Oblique");
          // Scale the typed signature to roughly fit the placeholder height.
          const sigSize = ph.height ? Math.min(ph.fontSize * 1.4, ph.height * 0.8) : ph.fontSize * 1.4;
          drawAlignedText(page, typed, ph, font, sigSize);
        }
      }
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
    const pageHeight = backPage.getHeight();
    const pageWidth = backPage.getWidth();
    const color = hexToRgb(input.unitsLayout?.color ?? "#222222");
    const font = await getFont("Helvetica");
    const headingFont = await getFont("Helvetica-Bold");
    const sorted = [...input.units].sort((a, b) => a.sortOrder - b.sortOrder);
    const count = sorted.length;

    // If the designer placed a "course_list" box, render the units THERE at the
    // user's chosen position, font size, width and alignment. This gives full
    // manual control (the user asked to enlarge/position the list themselves).
    const listPh = input.placeholders.find(
      (p) => p.kind === "course_list" || p.fieldKey === "course_units",
    );

    if (listPh) {
      const size = listPh.fontSize || 16;
      const gap = Math.max(4, Math.round(size * 0.5));
      const lineStep = size + gap;
      const maxWidth = listPh.width; // optional wrap width in points
      // WinAnsi-safe bullet: pdf-lib's standard fonts cannot encode U+2022 ("•"),
      // so we use a hyphen marker that always renders.
      const bullet = "-  ";

      // Top-left origin: listPh.y is where the title/first line's top sits.
      let topY = listPh.y;

      // Optional TITLE above the list. The box's `label` is used as the title
      // (e.g. "Units Covered"). We skip the generic default "Course List" so an
      // untitled box stays untitled. Title is bold and ~1.4x the unit size,
      // aligned the same way (left/center/right) as the list.
      const titleText = (listPh.label ?? "").trim();
      const showTitle = titleText && titleText.toLowerCase() !== "course list";
      if (showTitle) {
        const titleSize = Math.round(size * 1.4);
        const tw = headingFont.widthOfTextAtSize(titleText, titleSize);
        let tx = listPh.x;
        if (listPh.align === "center") tx = listPh.x - tw / 2;
        else if (listPh.align === "right") tx = listPh.x - tw;
        const tyBaseline = pageHeight - topY - titleSize;
        backPage.drawText(titleText, {
          x: tx,
          y: tyBaseline,
          size: titleSize,
          font: headingFont,
          color,
        });
        // Advance below the title (title height + a little breathing room).
        topY += titleSize + Math.max(6, Math.round(size * 0.6));
      }

      for (const unit of sorted) {
        const full = `${bullet}${unit.title}`;
        // Simple width-based wrapping when a width is set.
        const wrapped =
          maxWidth && maxWidth > 0
            ? wrapToWidth(full, font, size, maxWidth)
            : [full];
        for (const line of wrapped) {
          const lineWidth = font.widthOfTextAtSize(line, size);
          let x = listPh.x;
          if (listPh.align === "center") x = listPh.x - lineWidth / 2;
          else if (listPh.align === "right") x = listPh.x - lineWidth;
          const yBaseline = pageHeight - topY - size;
          backPage.drawText(line, { x, y: yBaseline, size, font, color });
          topY += lineStep;
        }
      }
      return out.save();
    }

    if (backWasAutoCreated || input.unitsLayout?.center) {
      // AUTO-CREATED (or explicitly centered) back page:
      // - centered heading + subtitle + a thin divider line
      // - units are LEFT-ALIGNED to a common left edge, but the whole block is
      //   CENTERED on the page (left edge = (pageWidth - widestLine) / 2), which
      //   reads better for long unit titles than per-line centering.
      // - font scales DOWN as the list grows so it always fits on one page.
      const heading = "Course Units";
      const headingSize = 24;
      const hw = headingFont.widthOfTextAtSize(heading, headingSize);
      const headingY = pageHeight - 96;
      backPage.drawText(heading, {
        x: (pageWidth - hw) / 2,
        y: headingY,
        size: headingSize,
        font: headingFont,
        color: hexToRgb("#222222"),
      });

      // Subtitle under the heading.
      const subtitle = "This certifies completion of the following units:";
      const subtitleSize = 12;
      const sw = font.widthOfTextAtSize(subtitle, subtitleSize);
      const subtitleY = headingY - 26;
      backPage.drawText(subtitle, {
        x: (pageWidth - sw) / 2,
        y: subtitleY,
        size: subtitleSize,
        font,
        color: hexToRgb("#555555"),
      });

      // Thin divider line below the subtitle.
      const dividerY = subtitleY - 14;
      const dividerHalf = Math.min(pageWidth * 0.32, 230);
      backPage.drawLine({
        start: { x: pageWidth / 2 - dividerHalf, y: dividerY },
        end: { x: pageWidth / 2 + dividerHalf, y: dividerY },
        thickness: 0.75,
        color: hexToRgb("#C9A227"),
      });

      // Dynamic sizing: big for few, smaller for many (clamped 11-26pt).
      const size = Math.max(11, Math.min(26, Math.round(90 / Math.max(3, count))));
      const gap = Math.max(6, Math.round(size * 0.55));
      const lineStep = size + gap;

      // Compute the widest line so we can left-align all lines to one edge while
      // keeping the block centered on the page.
      // WinAnsi-safe bullet ("-"): pdf-lib's standard fonts cannot encode U+2022.
      const lines = sorted.map((u) => `-  ${u.title}`);
      const widest = lines.reduce(
        (m, l) => Math.max(m, font.widthOfTextAtSize(l, size)),
        0,
      );
      const blockLeft = Math.max(64, (pageWidth - widest) / 2);

      // Vertically center the block in the area below the divider.
      const areaTop = dividerY - 28;
      const areaBottom = 80;
      const blockHeight = count * lineStep;
      const areaMid = (areaTop + areaBottom) / 2;
      let baseline = areaMid + blockHeight / 2 - size;
      if (baseline > areaTop - size) baseline = areaTop - size;

      lines.forEach((line) => {
        backPage!.drawText(line, {
          x: blockLeft, // left-aligned, but block is centered as a group
          y: baseline,
          size,
          font,
          color,
        });
        baseline -= lineStep;
      });
    } else {
      // USER-SUPPLIED back design: honour the configured fixed layout so it
      // lands exactly where their artwork expects it.
      const startY = input.unitsLayout?.y ?? 200;
      const startX = input.unitsLayout?.x ?? 72;
      const size = input.unitsLayout?.fontSize ?? 13;
      const gap = input.unitsLayout?.lineGap ?? 8;
      // WinAnsi-safe default bullet ("-"): pdf-lib's standard fonts cannot
      // encode U+2022 ("•"). A caller may still pass a custom bullet, but it
      // must be WinAnsi-encodable or rendering will throw.
      const bullet = input.unitsLayout?.bullet ?? "-  ";

      sorted.forEach((unit, i) => {
        const lineY = pageHeight - startY - i * (size + gap) - size;
        backPage!.drawText(`${bullet}${unit.title}`, {
          x: startX,
          y: lineY,
          size,
          font,
          color,
        });
      });
    }
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
