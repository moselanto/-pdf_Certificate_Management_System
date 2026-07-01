import { z } from "zod";

export const placeholderKind = z.enum([
  "text",
  "date",
  "qr",
  "image",
  "signature",
  "course_list",
]);
export const placeholderPage = z.enum(["front", "back"]);
export const textAlign = z.enum(["left", "center", "right"]);

const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/);

export const placeholderSchema = z.object({
  id: z.string().optional(),
  page: placeholderPage.default("front"),
  kind: placeholderKind.default("text"),
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  fontSize: z.number().positive().default(14),
  fontFamily: z.string().default("Helvetica"),
  color: hexColor.default("#111111"),
  align: textAlign.default("left"),
  // text/date: synthetic bold (engine strokes the glyph outline).
  bold: z.boolean().optional(),
  // QR appearance (optional)
  qrDark: hexColor.optional(),
  qrLight: hexColor.optional(),
  qrTransparent: z.boolean().optional(),
  // image/logo/signature: preserve intrinsic aspect ratio inside the box.
  lockAspect: z.boolean().optional(),
});

// --- Design elements (from-scratch builder) --------------------------------
// Discriminated by `kind`. Coordinates are points, top-left origin. Mirrors the
// DesignElement union in domain/types.ts. Used to validate the design_elements
// payload saved from the designer and rendered by the engine.
const designElementBase = {
  id: z.string(),
  page: placeholderPage.default("front"),
  z: z.number().optional(),
};

export const designTextSchema = z.object({
  ...designElementBase,
  kind: z.literal("text"),
  x: z.number(),
  y: z.number(),
  text: z.string(),
  fontSize: z.number().positive().default(24),
  fontFamily: z.string().default("Helvetica"),
  color: hexColor.default("#111111"),
  align: textAlign.default("left"),
  bold: z.boolean().optional(),
  width: z.number().optional(),
  lineGap: z.number().optional(),
});

export const designLineSchema = z.object({
  ...designElementBase,
  kind: z.literal("line"),
  x: z.number(),
  y: z.number(),
  x2: z.number(),
  y2: z.number(),
  thickness: z.number().positive().default(1),
  color: hexColor.default("#111111"),
});

export const designRectSchema = z.object({
  ...designElementBase,
  kind: z.literal("rect"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  strokeColor: hexColor.optional(),
  strokeWidth: z.number().optional(),
  fillColor: hexColor.optional(),
  cornerRadius: z.number().optional(),
});

export const designElementSchema = z.discriminatedUnion("kind", [
  designTextSchema,
  designLineSchema,
  designRectSchema,
]);

export const pageSizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const generateCertificateSchema = z.object({
  templateId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  trainerId: z.string().uuid().optional(),
  traineeId: z.string().uuid().optional(),
  recipientName: z.string().min(1),
  issueDate: z.string(), // ISO date
  values: z.record(z.string()).default({}),
});

export type GenerateCertificateInput = z.infer<typeof generateCertificateSchema>;
