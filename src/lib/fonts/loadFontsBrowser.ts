"use client";

// ============================================================================
// Browser-side font loading for the template designer canvas.
//
// The PDF engine embeds fonts server-side, but the on-screen editor is plain
// HTML/CSS — so for a field chip or drawn text to PREVIEW in its chosen font
// (Great Vibes, Montserrat, an uploaded Myriad Pro, etc.) the browser must
// actually have that font face loaded. The bundled fonts live in /public/fonts
// and custom uploaded fonts are served by /api/fonts/:id/file.
//
// This module:
//   • injects a single <style> tag with @font-face rules for every bundled
//     font (family name matches what the picker/engine use), and
//   • loads custom uploaded fonts on demand via the FontFace API.
//
// Font family names are used VERBATIM as the CSS family, so setting
// `style={{ fontFamily: ph.fontFamily }}` on a chip Just Works once loaded.
// ============================================================================

import { BUNDLED_FONTS } from "./bundledFonts";

const STYLE_ID = "certforge-bundled-fontfaces";

/**
 * Inject @font-face rules for all bundled fonts (idempotent). Safe to call on
 * every designer mount — it only writes the <style> tag once.
 */
export function ensureBundledFontFaces(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const rules = BUNDLED_FONTS.map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("/fonts/${f.file}") format("truetype");font-display:swap;}`,
  ).join("\n");

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = rules;
  document.head.appendChild(style);
}

// Track custom fonts we've already loaded so we don't re-fetch/re-register.
const loadedCustom = new Set<string>();

/**
 * Load custom uploaded fonts into the document via the FontFace API so they
 * render on the canvas. `fonts` is the list from /api/fonts (id + family). The
 * file is served by GET /api/fonts/:id/file. Failures are swallowed (the chip
 * simply falls back to a default font, matching the engine's own fallback).
 */
export async function loadCustomFontFaces(
  fonts: { id: string; family: string }[],
): Promise<void> {
  if (typeof document === "undefined" || !("FontFace" in window)) return;

  await Promise.all(
    fonts.map(async ({ id, family }) => {
      const key = `${id}:${family.toLowerCase()}`;
      if (loadedCustom.has(key)) return;
      loadedCustom.add(key);
      try {
        const face = new FontFace(family, `url("/api/fonts/${id}/file")`);
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        // Corrupt/unavailable font — leave it unloaded; the chip falls back to
        // a default font, just like the PDF engine does.
        loadedCustom.delete(key);
      }
    }),
  );
}
