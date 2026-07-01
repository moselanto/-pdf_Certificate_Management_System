// Domain types shared across the engine, API, and UI.
// Kept dependency-free so the PDF engine stays pure & testable.

export type PlaceholderKind =
  | "text"
  | "date"
  | "qr"
  | "image"
  | "signature"
  | "course_list"; // a positioned, sizable box that renders the course units list
export type PlaceholderPage = "front" | "back";
export type TextAlign = "left" | "center" | "right";

/**
 * A placeholder positioned on a template page.
 * Coordinates use a TOP-LEFT origin (matches the browser editor). The PDF
 * engine converts to pdf-lib's bottom-left origin at render time.
 */
export interface Placeholder {
  id: string;
  page: PlaceholderPage;
  kind: PlaceholderKind;
  fieldKey: string; // maps to a value at generation time, e.g. "recipient_name"
  label: string;
  x: number; // points, top-left origin
  y: number;
  width?: number;
  height?: number;
  fontSize: number;
  fontFamily: string;
  color: string; // hex, e.g. "#111111"
  align: TextAlign;
  // text/date-only: render bold. Since bundled/custom fonts ship as a single
  // (regular) weight, the engine applies SYNTHETIC bold (a thin glyph outline
  // stroke) so any font can be bolded without a separate bold file.
  bold?: boolean;
  // QR-only appearance (optional). qrDark = module color, qrLight = background.
  // Set qrTransparent true to render the QR background transparent — useful on
  // dark certificate backgrounds together with a light qrDark color.
  qrDark?: string; // hex, e.g. "#FFFFFF"
  qrLight?: string; // hex, e.g. "#FFFFFF"
  qrTransparent?: boolean;
  // image/logo/signature-only: when true, preserve the image's intrinsic aspect
  // ratio inside the width x height box ("contain"), instead of stretching to
  // fill it. The image is centered within the box. Defaults false.
  lockAspect?: boolean;
}

// ============================================================================
// Design elements — the "from scratch" certificate builder.
//
// Unlike Placeholders (which map to per-recipient VALUES filled at generation
// time), design elements are STATIC artwork the designer draws directly onto
// the certificate: fixed text (titles, body copy), straight lines (rules,
// signature lines), and rectangles (borders, panels). They form the background
// a from-scratch certificate is built on, replacing an uploaded PDF template.
//
// Coordinates use the SAME top-left origin as Placeholder, so the engine reuses
// the pdfY = pageHeight - y conversion. Placeholders are drawn ON TOP of design
// elements, so dynamic fields (recipient name, QR, etc.) sit above the artwork.
// ============================================================================

export type DesignElementKind = "text" | "line" | "rect";

/** Base fields shared by every design element. */
interface DesignElementBase {
  id: string;
  page: PlaceholderPage;
  kind: DesignElementKind;
  x: number; // points, top-left origin
  y: number;
  /** Draw order within a page; higher renders later (on top). Optional. */
  z?: number;
}

/** Static text drawn directly on the certificate (titles, body copy, labels). */
export interface DesignTextElement extends DesignElementBase {
  kind: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string; // hex
  align: TextAlign;
  /** Render bold via synthetic bold (glyph outline stroke). Any font can bold. */
  bold?: boolean;
  /** Optional wrap width in points; when set, text word-wraps to this width. */
  width?: number;
  lineGap?: number; // extra points between wrapped lines (default derived from size)
}

/**
 * A straight line from (x,y) to (x2,y2), both top-left origin points.
 * Used for rules, dividers, and signature lines.
 */
export interface DesignLineElement extends DesignElementBase {
  kind: "line";
  x2: number;
  y2: number;
  thickness: number; // points
  color: string; // hex, stroke color
}

/**
 * A rectangle / border / panel. (x,y) is the top-left corner; width/height in
 * points. strokeColor+strokeWidth draw the border; fillColor (optional) fills
 * the interior. Set cornerRadius for rounded corners.
 */
export interface DesignRectElement extends DesignElementBase {
  kind: "rect";
  width: number;
  height: number;
  strokeColor?: string; // hex; omit for no border
  strokeWidth?: number; // points; default 1 when strokeColor set
  fillColor?: string; // hex; omit for transparent interior
  cornerRadius?: number; // points; 0 = square corners
}

export type DesignElement =
  | DesignTextElement
  | DesignLineElement
  | DesignRectElement;

/** Standard blank-canvas page sizes (points) for from-scratch certificates. */
export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_SIZES = {
  // A4 at 72dpi: 210 x 297 mm.
  a4_landscape: { width: 842, height: 595 } as PageSize,
  a4_portrait: { width: 595, height: 842 } as PageSize,
  // US Letter: 8.5 x 11 in.
  letter_landscape: { width: 792, height: 612 } as PageSize,
  letter_portrait: { width: 612, height: 792 } as PageSize,
} as const;

export type PageSizeKey = keyof typeof PAGE_SIZES;

export interface CourseUnit {
  id: string;
  sortOrder: number;
  title: string;
}

/** Everything the engine needs to render one certificate. */
export interface RenderInput {
  /**
   * Uploaded template front. OPTIONAL: when omitted, the engine builds a blank
   * "from scratch" certificate using `blankPage` for the page size and draws
   * `designElements` as the background. Provide EITHER frontPdf OR blankPage.
   */
  frontPdf?: Uint8Array;
  backPdf?: Uint8Array; // optional uploaded template back
  /**
   * Page size for a from-scratch (no frontPdf) certificate. Defaults to A4
   * landscape when neither frontPdf nor blankPage is supplied.
   */
  blankPage?: PageSize;
  /**
   * Static artwork drawn directly on the certificate (from-scratch builder).
   * Drawn BEFORE placeholders so dynamic fields render on top.
   */
  designElements?: DesignElement[];
  placeholders: Placeholder[];
  /** Field values keyed by Placeholder.fieldKey (strings already formatted). */
  values: Record<string, string>;
  /** Pre-rendered PNG bytes keyed by fieldKey, for qr / image / signature. */
  images?: Record<string, Uint8Array>;
  /**
   * Custom font files keyed by family name (the same string a placeholder sets
   * as fontFamily). When a placeholder's fontFamily matches a key here, the
   * engine embeds that TrueType/OpenType font via fontkit instead of mapping to
   * a standard font. Resolution is case-insensitive on the family name.
   */
  customFonts?: Record<string, Uint8Array>;
  /** Course units rendered as a list onto the back page (if any). */
  units?: CourseUnit[];
  /** Where the units list is anchored on the back page (top-left origin). */
  unitsLayout?: {
    x: number;
    y: number;
    fontSize?: number;
    lineGap?: number;
    bullet?: string;
    color?: string;
    center?: boolean;
  };
}
