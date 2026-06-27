import { z } from "zod";

export const placeholderKind = z.enum(["text", "date", "qr", "image", "signature"]);
export const placeholderPage = z.enum(["front", "back"]);
export const textAlign = z.enum(["left", "center", "right"]);

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
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).default("#111111"),
  align: textAlign.default("left"),
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
