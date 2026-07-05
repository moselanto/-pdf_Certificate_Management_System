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
import fontkit from "@pdf-lib/fontkit";
import type {
  CourseUnit,
  DesignElement,
  DesignLineElement,
  DesignRectElement,
  DesignTextElement,
  PageSize,
  Placeholder,
  RenderInput,
  TextAlign,
} from "@/lib/domain/types";

// Default page size for a from-scratch certificate when none is supplied.
const DEFAULT_BLANK_PAGE: PageSize = { width: 842, height: 595 }; // A4 landscape

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

// Synthetic bold: pdf-lib can draw a glyph outline stroke on top of the fill.
// Stroking with the fill color at ~4% of the font size thickens every stroke,
// approximating a bold weight for fonts that ship only a regular file (all our
// bundled fonts + single-file custom uploads). This keeps "Bold" working on
// EVERY font without needing a separate bold face.
function boldStrokeOpts(size: number, color: RGB) {
  return {
    // borderWidth on drawText maps to the text render mode "fill + stroke".
    borderWidth: Math.max(0.4, size * 0.04),
    borderColor: color,
  };
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

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
    ...(ph.bold ? boldStrokeOpts(size, color) : {}),
  });
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

// ============================================================================
// Design-element drawing (from-scratch builder). These render STATIC artwork
// (fixed text, lines, rectangles) using the same top-left origin as
// placeholders, converting to pdf-lib's bottom-left origin with pageHeight - y.
// ============================================================================

async function drawDesignText(
  page: PDFPage,
  el: DesignTextElement,
  getFont: (family: string) => Promise<PDFFont>,
) {
  const text = el.text ?? "";
  if (!text) return;
  const size = el.fontSize || 16;
  const color = hexToRgb(el.color);
  const font = await getFont(el.fontFamily);
  const pageHeight = page.getHeight();

  // Optional word-wrap when a width is set; otherwise a single line.
  const lines =
    el.width && el.width > 0 ? wrapToWidth(text, font, size, el.width) : [text];
  const gap = el.lineGap ?? Math.round(size * 0.35);
  const lineStep = size + gap;

  const boldOpts = el.bold ? boldStrokeOpts(size, color) : {};

  let topY = el.y;
  for (const line of lines) {
    const lineWidth = font.widthOfTextAtSize(line, size);
    let x = el.x;
    if (el.align === "center") x = el.x - lineWidth / 2;
    else if (el.align === "right") x = el.x - lineWidth;
    const yBaseline = pageHeight - topY - size;
    page.drawText(line, { x, y: yBaseline, size, font, color, ...boldOpts });
    topY += lineStep;
  }
}

function drawDesignLine(page: PDFPage, el: DesignLineElement) {
  const pageHeight = page.getHeight();
  page.drawLine({
    start: { x: el.x, y: pageHeight - el.y },
    end: { x: el.x2, y: pageHeight - el.y2 },
    thickness: el.thickness || 1,
    color: hexToRgb(el.color),
  });
}

function drawDesignRect(page: PDFPage, el: DesignRectElement) {
  const pageHeight = page.getHeight();
  // Top-left origin: convert the top-left corner to pdf-lib's bottom-left by
  // subtracting the height as well, since pdf-lib positions rects by their
  // bottom-left corner.
  const y = pageHeight - el.y - el.height;
  const opts: Parameters<PDFPage["drawRectangle"]>[0] = {
    x: el.x,
    y,
    width: el.width,
    height: el.height,
  };
  if (el.fillColor) opts.color = hexToRgb(el.fillColor);
  if (el.strokeColor) {
    opts.borderColor = hexToRgb(el.strokeColor);
    opts.borderWidth = el.strokeWidth ?? 1;
  }
  // pdf-lib supports rounded corners via the (undocumented but stable) rx/ry
  // — but to stay on the typed API we approximate: only apply when supported.
  page.drawRectangle(opts);
}

// ============================================================================
// Course-content rendering (back page). Units may carry an optional `section`
// so a flat list can become grouped sub-sections (e.g. "Theory", "Practical"),
// each with its own checklist. Checkmarks are drawn as small VECTOR ticks
// rather than a check glyph, because pdf-lib's standard WinAnsi fonts cannot
// encode check/bullet characters (that previously crashed rendering).
// ============================================================================

type CourseContentLine =
  | { kind: "heading"; text: string }
  | { kind: "item"; text: string };

/**
 * Flatten ordered units into heading/item lines. A section heading is emitted
 * once, when the section changes; units without a section emit items only, so a
 * plain (ungrouped) list renders exactly as before (just with a tick marker).
 */
function unitsToContentLines(units: CourseUnit[]): CourseContentLine[] {
  const lines: CourseContentLine[] = [];
  let currentSection: string | undefined;
  for (const u of units) {
    const section = u.section?.trim() || undefined;
    if (section) {
      if (section !== currentSection) {
        lines.push({ kind: "heading", text: section });
        currentSection = section;
      }
    } else {
      currentSection = undefined;
    }
    lines.push({ kind: "item", text: u.title });
  }
  return lines;
}

/** Draw a small vector checkmark whose lower-left sits near a text baseline. */
function drawCheck(
  page: PDFPage,
  x: number,
  baselineY: number,
  size: number,
  color: RGB,
) {
  const t = Math.max(0.8, size * 0.08);
  page.drawLine({
    start: { x: x + size * 0.02, y: baselineY + size * 0.3 },
    end: { x: x + size * 0.24, y: baselineY + size * 0.06 },
    thickness: t,
    color,
  });
  page.drawLine({
    start: { x: x + size * 0.24, y: baselineY + size * 0.06 },
    end: { x: x + size * 0.6, y: baselineY + size * 0.66 },
    thickness: t,
    color,
  });
}

interface CourseContentLayout {
  anchorX: number;
  align?: TextAlign;
  size: number;
  topY: number; // top-left origin start
  maxWidth?: number; // optional item wrap width in points
  color: RGB;
  font: PDFFont; // item font
  headingFont: PDFFont; // section-heading font (bold)
}

/**
 * Render grouped course content (section headings + checkmark items) starting
 * at layout.topY (top-left origin). Returns the next free topY. Shared by the
 * placed-box, auto-back-page, and fixed-layout paths so all three group and
 * tick identically.
 */
function renderCourseContent(
  page: PDFPage | null,
  units: CourseUnit[],
  layout: CourseContentLayout,
): number {
  // page === null => MEASURE ONLY: advance topY exactly as when drawing, but
  // skip the actual draw calls. This lets measureCourseContent reuse the very
  // same layout math the renderer draws with, so the two can never drift apart.
  const pageHeight = page ? page.getHeight() : 0;
  const size = layout.size;
  const itemGap = Math.max(4, Math.round(size * 0.5));
  const headingSize = Math.round(size * 1.15);
  const headingGapBefore = Math.round(size * 0.7);
  const headingGapAfter = Math.round(size * 0.3);
  const checkAdvance = size * 0.62 + size * 0.3;
  let topY = layout.topY;

  const drawRow = (
    text: string,
    drawSize: number,
    rowFont: PDFFont,
    withCheck: boolean,
    indent: number,
  ) => {
    const textWidth = rowFont.widthOfTextAtSize(text, drawSize);
    const lead = withCheck ? checkAdvance : indent;
    const total = lead + textWidth;
    let startX = layout.anchorX;
    if (layout.align === "center") startX = layout.anchorX - total / 2;
    else if (layout.align === "right") startX = layout.anchorX - total;
    const yBaseline = pageHeight - topY - drawSize;
    if (page) {
      if (withCheck) {
        drawCheck(page, startX, yBaseline, drawSize, layout.color);
      }
      page.drawText(text, {
        x: startX + lead,
        y: yBaseline,
        size: drawSize,
        font: rowFont,
        color: layout.color,
      });
    }
  };

  for (const line of unitsToContentLines(units)) {
    if (line.kind === "heading") {
      topY += headingGapBefore;
      // Wrap long section headings to the full width too (not just items) so a
      // long heading never runs off the edge.
      const headMax =
        layout.maxWidth && layout.maxWidth > 0
          ? Math.max(40, layout.maxWidth)
          : undefined;
      const headWrapped = headMax
        ? wrapToWidth(line.text, layout.headingFont, headingSize, headMax)
        : [line.text];
      const headLineGap = Math.max(2, Math.round(headingSize * 0.2));
      headWrapped.forEach((sub, i) => {
        drawRow(sub, headingSize, layout.headingFont, false, 0);
        topY += headingSize;
        if (i < headWrapped.length - 1) topY += headLineGap;
      });
      topY += headingGapAfter;
    } else {
      const itemMax =
        layout.maxWidth && layout.maxWidth > 0
          ? Math.max(40, layout.maxWidth - checkAdvance)
          : undefined;
      const wrapped = itemMax
        ? wrapToWidth(line.text, layout.font, size, itemMax)
        : [line.text];
      wrapped.forEach((sub, idx) => {
        drawRow(sub, size, layout.font, idx === 0, idx === 0 ? 0 : checkAdvance);
        topY += size + itemGap;
      });
    }
  }
  return topY;
}

/** Height (in points) the grouped content occupies at layout.size. */
export function measureCourseContent(
  units: CourseUnit[],
  layout: CourseContentLayout,
): number {
  return renderCourseContent(null, units, layout) - layout.topY;
}

/**
 * Largest font size in [minSize, maxSize] at which the grouped content fits
 * within availableHeight. Wrapping is re-evaluated at each candidate size (a
 * smaller font wraps fewer lines), so this shrinks-to-fit precisely. Falls back
 * to minSize when even that overflows (extreme lists) — the best a single page
 * can do.
 */
export function fitCourseContentSize(
  units: CourseUnit[],
  baseLayout: Omit<CourseContentLayout, "size">,
  maxSize: number,
  minSize: number,
  availableHeight: number,
): number {
  const hi = Math.max(minSize, Math.round(maxSize));
  for (let s = hi; s > minSize; s -= 1) {
    if (
      measureCourseContent(units, { ...baseLayout, size: s }) <= availableHeight
    ) {
      return s;
    }
  }
  return minSize;
}

/**
 * Top-left Y for a block of height `totalHeight` whose vertical CENTRE should
 * sit at `centerY`, clamped so the block never runs past the top/bottom page
 * margins. When the block is taller than the usable page it starts at the top
 * margin (overflow is unavoidable). Used to vertically centre the course list
 * on its anchor / the page centre.
 */
export function centerBlockTop(
  centerY: number,
  totalHeight: number,
  pageHeight: number,
  topMargin: number,
  bottomMargin: number,
): number {
  const minTop = topMargin;
  const maxTop = pageHeight - bottomMargin - totalHeight;
  if (maxTop < minTop) return minTop;
  return Math.max(minTop, Math.min(maxTop, centerY - totalHeight / 2));
}

/**
 * Render a certificate PDF from a template + values.
 * Returns the finished PDF as bytes (ready to upload or stream for download).
 */
export async function renderCertificate(input: RenderInput): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  // --- FRONT ---------------------------------------------------------------
  // Two modes:
  //   1. TEMPLATE mode: an uploaded frontPdf is copied in and drawn on top of.
  //   2. FROM-SCRATCH mode: no frontPdf, so we create a blank page sized by
  //      input.blankPage (default A4 landscape). designElements form the
  //      background artwork; placeholders and course units render on top.
  let frontPage: PDFPage;
  if (input.frontPdf) {
    const frontSrc = await PDFDocument.load(input.frontPdf);
    const [fp] = await out.copyPages(frontSrc, [0]);
    frontPage = out.addPage(fp);
  } else {
    const size = input.blankPage ?? DEFAULT_BLANK_PAGE;
    frontPage = out.addPage([size.width, size.height]);
  }
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

  // Custom-font support: register fontkit once (only needed when custom fonts
  // are supplied) so out.embedFont can ingest raw TTF/OTF bytes.
  const customFonts = input.customFonts ?? {};
  // Normalise the supplied family names for case-insensitive lookup.
  const customByLower = new Map<string, Uint8Array>();
  for (const [family, bytes] of Object.entries(customFonts)) {
    customByLower.set(family.toLowerCase(), bytes);
  }
  if (customByLower.size > 0) {
    out.registerFontkit(fontkit);
  }

  // Cache by the resolved cache key (a StandardFonts enum value OR the custom
  // family's lowercased name) so each font is embedded at most once.
  const fontCache = new Map<string, PDFFont>();
  const getFont = async (family: string): Promise<PDFFont> => {
    const lower = (family ?? "").toLowerCase();
    // 1. A custom uploaded font wins when its family matches.
    const customBytes = customByLower.get(lower);
    if (customBytes) {
      if (!fontCache.has(lower)) {
        try {
          fontCache.set(lower, await out.embedFont(customBytes, { subset: true }));
        } catch {
          // Corrupt/unsupported font — fall back to a standard font so the
          // certificate still renders rather than failing the whole batch.
          const key = standardFontFor(family);
          if (!fontCache.has(key)) fontCache.set(key, await out.embedFont(key));
          return fontCache.get(key)!;
        }
      }
      return fontCache.get(lower)!;
    }
    // 2. Otherwise map to a standard font.
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

  // --- Design elements (from-scratch artwork) ------------------------------
  // Drawn BEFORE placeholders so dynamic fields (name, QR, etc.) sit on top of
  // the static artwork. Elements are sorted by optional z so the designer can
  // control layering (e.g. a filled panel behind its text).
  if (input.designElements?.length) {
    const sorted = [...input.designElements].sort(
      (a, b) => (a.z ?? 0) - (b.z ?? 0),
    );
    for (const el of sorted) {
      const page = el.page === "back" ? backPage : frontPage;
      if (!page) continue; // back element but no back page — skip safely
      if (el.kind === "text") {
        await drawDesignText(page, el, getFont);
      } else if (el.kind === "line") {
        drawDesignLine(page, el);
      } else if (el.kind === "rect") {
        drawDesignRect(page, el);
      }
    }
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

    // If the designer placed a "course_list" box, render the units THERE at the
    // user's chosen position, font size, width and alignment. This gives full
    // manual control (the user asked to enlarge/position the list themselves).
    const listPh = input.placeholders.find(
      (p) => p.kind === "course_list" || p.fieldKey === "course_units",
    );

    if (listPh) {
      const requestedSize = listPh.fontSize || 16;
      // Always wrap the list: use the box width when set, else a sensible
      // fraction of the page, so long lines never run off the edge — even for a
      // point (width-less) box.
      const wrapWidth =
        listPh.width && listPh.width > 0 ? listPh.width : pageWidth * 0.7;

      // Optional TITLE above the list. The box's `label` is used as the title
      // (e.g. "Course Content"). We skip the generic default "Course List" so an
      // untitled box stays untitled. Title is bold and ~1.4x the unit size,
      // aligned the same way (left/center/right) as the list.
      const titleText = (listPh.label ?? "").trim();
      const showTitle =
        Boolean(titleText) && titleText.toLowerCase() !== "course list";
      const titleSize = showTitle ? Math.round(requestedSize * 1.4) : 0;
      const titleGap = showTitle ? Math.max(6, Math.round(requestedSize * 0.6)) : 0;
      const titleBlock = titleSize + titleGap;

      // Region the whole block (title + list) may occupy, and the point it
      // should be centred on. When the box has an explicit height, use it and
      // treat the box's MIDDLE as the centre; otherwise the anchor is a point,
      // so use the usable page height and centre the block on listPh.y itself.
      const topMargin = 40;
      const bottomMargin = 40;
      const hasBoxHeight = Boolean(listPh.height && listPh.height > 0);
      const regionHeight = hasBoxHeight
        ? (listPh.height as number)
        : pageHeight - topMargin - bottomMargin;
      const centerY = hasBoxHeight
        ? listPh.y + (listPh.height as number) / 2
        : listPh.y;

      // Shrink the list to fit the space left after the title, then measure the
      // fitted list so we know the true block height.
      const listBase = {
        anchorX: listPh.x,
        align: listPh.align,
        topY: 0,
        maxWidth: wrapWidth,
        color,
        font,
        headingFont,
      };
      const availableForList = Math.max(24, regionHeight - titleBlock);
      const fittedSize = fitCourseContentSize(
        sorted,
        listBase,
        requestedSize,
        7,
        availableForList,
      );
      const listHeight = measureCourseContent(sorted, {
        ...listBase,
        size: fittedSize,
      });

      // Vertically CENTRE the whole block on the anchor / box middle (clamped to
      // the page margins) so it reads as centred instead of flowing down from a
      // top anchor. Dragging the box — or "Center selected on page" — now truly
      // centres the content top-to-bottom.
      const totalHeight = titleBlock + listHeight;
      let topY = centerBlockTop(
        centerY,
        totalHeight,
        pageHeight,
        topMargin,
        bottomMargin,
      );

      if (showTitle) {
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
        topY += titleBlock;
      }

      renderCourseContent(backPage, sorted, {
        ...listBase,
        size: fittedSize,
        topY,
      });
      return out.save();
    }

    if (backWasAutoCreated || input.unitsLayout?.center) {
      // AUTO-CREATED (or explicitly centered) back page:
      // - centered heading + subtitle + a thin divider line
      // - grouped course content is rendered centered below the divider
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

      // Start the grouped content just below the divider (top-left origin).
      const contentTopY = pageHeight - dividerY + 22;
      // Shrink-to-fit: measure the real wrapped height and pick the largest
      // size (<=26pt) that fits from here down to a bottom margin, so even a
      // very long list stays on this one page instead of running off the bottom.
      const bottomMargin = 54;
      const availableHeight = Math.max(
        40,
        pageHeight - bottomMargin - contentTopY,
      );
      const centeredBase = {
        anchorX: pageWidth / 2,
        align: "center" as const,
        topY: contentTopY,
        maxWidth: pageWidth * 0.7,
        color,
        font,
        headingFont,
      };
      const size = fitCourseContentSize(
        sorted,
        centeredBase,
        26,
        9,
        availableHeight,
      );
      renderCourseContent(backPage, sorted, { ...centeredBase, size });
    } else {
      // USER-SUPPLIED back design: honour the configured fixed position, but
      // still WRAP to the page width and shrink-to-fit the height so a long list
      // never runs off the edge or past the bottom of their artwork.
      const startY = input.unitsLayout?.y ?? 200;
      const startX = input.unitsLayout?.x ?? 72;
      const requestedSize = input.unitsLayout?.fontSize ?? 13;
      const rightMargin = 48;
      const bottomMargin = 40;
      const wrapWidth = Math.max(120, pageWidth - startX - rightMargin);
      const availableHeight = Math.max(24, pageHeight - bottomMargin - startY);
      const fixedBase = {
        anchorX: startX,
        align: "left" as const,
        topY: startY,
        maxWidth: wrapWidth,
        color,
        font,
        headingFont,
      };
      const size = fitCourseContentSize(
        sorted,
        fixedBase,
        requestedSize,
        7,
        availableHeight,
      );
      renderCourseContent(backPage, sorted, { ...fixedBase, size });
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
