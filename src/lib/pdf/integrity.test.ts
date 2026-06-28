import { describe, it, expect } from "vitest";
import { computeIntegrityHash, INTEGRITY_ALG } from "./integrity";

const fields = {
  certificateNumber: "CF-2026-7QK3M9",
  recipientName: "Jane W. Mwangi",
  issueDate: "2026-06-29",
  orgId: "org-123",
};

describe("computeIntegrityHash", () => {
  it("returns a 64-char lowercase hex SHA-256 digest", async () => {
    const hash = await computeIntegrityHash(new Uint8Array([1, 2, 3]), fields);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(INTEGRITY_ALG).toBe("SHA-256");
  });

  it("is deterministic for identical inputs", async () => {
    const a = await computeIntegrityHash(new Uint8Array([9, 8, 7]), fields);
    const b = await computeIntegrityHash(new Uint8Array([9, 8, 7]), fields);
    expect(a).toBe(b);
  });

  it("changes when the PDF bytes change (tamper-evidence)", async () => {
    const a = await computeIntegrityHash(new Uint8Array([1, 2, 3]), fields);
    const b = await computeIntegrityHash(new Uint8Array([1, 2, 4]), fields);
    expect(a).not.toBe(b);
  });

  it("changes when an identifying field changes", async () => {
    const a = await computeIntegrityHash(new Uint8Array([1, 2, 3]), fields);
    const b = await computeIntegrityHash(new Uint8Array([1, 2, 3]), {
      ...fields,
      recipientName: "Someone Else",
    });
    expect(a).not.toBe(b);
  });

  it("ignores surrounding whitespace on the recipient name (canonicalised)", async () => {
    const a = await computeIntegrityHash(new Uint8Array([5]), fields);
    const b = await computeIntegrityHash(new Uint8Array([5]), {
      ...fields,
      recipientName: "  Jane W. Mwangi  ",
    });
    expect(a).toBe(b);
  });
});
