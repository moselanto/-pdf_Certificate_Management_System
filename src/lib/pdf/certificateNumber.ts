// Human-readable, collision-resistant certificate numbers.
// Format: PREFIX-YYYY-XXXXXX  e.g.  CF-2026-7QK3M9

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

export function generateCertificateNumber(prefix = "CF"): string {
  const year = new Date().getFullYear();
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${year}-${suffix}`;
}
