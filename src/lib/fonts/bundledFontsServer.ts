/**
 * Server-only helpers for bundled fonts.
 *
 * Bundled fonts ship in `public/fonts` (see bundledFonts.ts). At render time we
 * read their bytes from disk and hand them to the engine in the same
 * `customFonts` (family -> bytes) map used for org-uploaded fonts. This keeps a
 * single resolution path in the engine.
 *
 * This module uses `fs`/`path` and must only be imported from server code
 * (route handlers / services), never from a client component.
 */

import { promises as fs } from "fs";
import path from "path";
import { BUNDLED_FONTS } from "./bundledFonts";

/** Absolute path to a bundled font file inside `public/fonts`. */
function bundledFontPath(file: string): string {
  return path.join(process.cwd(), "public", "fonts", file);
}

/**
 * Read the bytes for the bundled fonts whose family appears in `families`
 * (case-insensitive). Returns a family -> bytes map. Missing/failed files are
 * skipped silently — the engine falls back to a standard font.
 *
 * Pass the set of families actually used so we don't read files we don't need.
 * Pass `undefined` to load every bundled font (used to expose the full set).
 */
export async function loadBundledFonts(
  families?: string[],
): Promise<Record<string, Uint8Array>> {
  const wanted =
    families && families.length
      ? new Set(families.map((f) => f.trim().toLowerCase()))
      : undefined;

  const out: Record<string, Uint8Array> = {};
  await Promise.all(
    BUNDLED_FONTS.map(async (bf) => {
      if (wanted && !wanted.has(bf.family.toLowerCase())) return;
      try {
        const buf = await fs.readFile(bundledFontPath(bf.file));
        out[bf.family] = new Uint8Array(buf);
      } catch {
        /* bundled font missing on disk — skip; engine falls back */
      }
    }),
  );
  return out;
}
