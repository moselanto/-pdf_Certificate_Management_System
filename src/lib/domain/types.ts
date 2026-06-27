// Domain types shared across the engine, API, and UI.
// Kept dependency-free so the PDF engine stays pure & testable.

export type PlaceholderKind = "text" | "date" | "qr" | "image" | "signature";
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
  };
}
