import { z } from "zod";

export const placeholderKind = z.enum(["text", "date", "qr", "image", "signature"]);
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
  // QR appearance (optional)
  qrDark: hexColor.optional(),
  qrLight: hexColor.optional(),
  qrTransparent: z.boolean().optional(),
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
