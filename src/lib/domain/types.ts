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

export interface CourseUnit {
  id: string;
  sortOrder: number;
  title: string;
}

/** Everything the engine needs to render one certificate. */
export interface RenderInput {
  frontPdf: Uint8Array; // uploaded template front
  backPdf?: Uint8Array; // optional uploaded template back
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
