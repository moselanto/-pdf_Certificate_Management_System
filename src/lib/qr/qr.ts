import QRCode from "qrcode";

/** Build the public verification URL for a certificate. */
export function verificationUrl(certificateNumber: string, token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({ t: token });
  return `${base}/verify/${encodeURIComponent(certificateNumber)}?${params}`;
}

/** Render a QR code (PNG bytes) that points at the verification URL. */
export async function qrPng(data: string, size = 256): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(data, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const base64 = dataUrl.split(",")[1];
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
