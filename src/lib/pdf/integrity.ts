// ============================================================================
// Content-integrity signature for issued certificates.
//
// Computes a SHA-256 over a canonical payload that binds the rendered PDF bytes
// to the certificate's identifying fields. Stored at generation time and shown
// on the public verification page so a holder can re-hash the PDF and confirm
// it was not altered after issue (tamper-evidence).
//
// IMPORTANT — scope: this is a content-integrity hash, NOT a PAdES / PKCS#7
// PDF digital signature. It proves "these bytes are exactly what we issued";
// it is not an X.509-backed signature that a PDF reader renders a trust badge
// for. A full PAdES signer is tracked separately in the ROADMAP. Keeping this
// pure + dependency-free (Web Crypto) means it runs in the same edge/node
// runtime as the rest of the engine.
// ============================================================================

export const INTEGRITY_ALG = "SHA-256";

export interface IntegrityFields {
  certificateNumber: string;
  recipientName: string;
  issueDate: string; // ISO
  orgId: string;
}

/**
 * Canonical string bound into the hash alongside the PDF bytes. Order and
 * separators are fixed so the same inputs always produce the same digest. The
 * verification side does not need to recompute this (it re-hashes the stored
 * PDF + the same fields), but pinning the format keeps it reproducible.
 */
function canonicalHeader(f: IntegrityFields): string {
  return [
    "certforge-v1",
    f.certificateNumber,
    f.recipientName.trim(),
    f.issueDate,
    f.orgId,
  ].join("\n");
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the integrity hash over the canonical header + the PDF bytes.
 * Returns a lowercase hex SHA-256 digest.
 */
export async function computeIntegrityHash(
  pdfBytes: Uint8Array,
  fields: IntegrityFields,
): Promise<string> {
  const headerBytes = new TextEncoder().encode(canonicalHeader(fields) + "\n");
  const combined = new Uint8Array(headerBytes.length + pdfBytes.length);
  combined.set(headerBytes, 0);
  combined.set(pdfBytes, headerBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return toHex(digest);
}
