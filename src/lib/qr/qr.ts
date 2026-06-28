import QRCode from "qrcode";

/** Build the public verification URL for a certificate. */
export function verificationUrl(certificateNumber: string, token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({ t: token });
  return `${base}/verify/${encodeURIComponent(certificateNumber)}?${params}`;
}

export interface QrOptions {
  /** Raster size in px (higher = crisper when scaled on the PDF). Default 256. */
  size?: number;
  /** Dark module color (the QR pattern). Hex, e.g. "#FFFFFF" for dark backgrounds. */
  dark?: string;
  /** Light/background color. Use "#00000000" for a transparent background. */
  light?: string;
}

/**
 * Render a QR code (PNG bytes) that points at the verification URL.
 * Colors are configurable so the QR stays readable on dark certificate
 * backgrounds (e.g. white modules on a transparent background).
 */
export async function qrPng(data: string, opts: QrOptions = {}): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(data, {
    width: opts.size ?? 256,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: opts.dark ?? "#000000",
      light: opts.light ?? "#FFFFFF",
    },
  });
  const base64 = dataUrl.split(",")[1];
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
