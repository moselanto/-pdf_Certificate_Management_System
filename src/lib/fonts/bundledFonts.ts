/**
 * Bundled fonts shipped with CertForge.
 *
 * These are free / open-licensed fonts (SIL Open Font License) that we ship in
 * `public/fonts` so they are available in every font picker with zero uploading.
 * The engine embeds them by family name exactly like org-uploaded custom fonts —
 * the only difference is the bytes come from disk (this repo) instead of Supabase
 * Storage.
 *
 * Adding a font: drop the .ttf into `public/fonts`, add an entry below. Keep the
 * `family` name matching what a user would recognise (it is what appears in the
 * picker AND what the engine matches on, case-insensitively).
 *
 * NOTE: Commercial fonts (e.g. Myriad Pro, Edwardian Script ITC) cannot legally be
 * bundled here. Users upload their own licensed copies via Settings → Fonts.
 */

export interface BundledFont {
  /** Display + match name shown in the picker and matched by the engine. */
  family: string;
  /** File name inside `public/fonts`. */
  file: string;
  /** Rough category, used only to group the picker. */
  category: "script" | "serif" | "sans";
}

export const BUNDLED_FONTS: BundledFont[] = [
  // Script / handwriting — great for signatures and recipient names
  { family: "Great Vibes", file: "GreatVibes-Regular.ttf", category: "script" },
  { family: "Alex Brush", file: "AlexBrush-Regular.ttf", category: "script" },
  { family: "Pinyon Script", file: "PinyonScript-Regular.ttf", category: "script" },
  { family: "Sacramento", file: "Sacramento-Regular.ttf", category: "script" },
  { family: "Tangerine", file: "Tangerine-Regular.ttf", category: "script" },
  // Serif — classic, formal certificate body text
  { family: "Playfair Display", file: "PlayfairDisplay-Regular.ttf", category: "serif" },
  { family: "Cinzel", file: "Cinzel-Regular.ttf", category: "serif" },
  { family: "Cormorant Garamond", file: "CormorantGaramond-Regular.ttf", category: "serif" },
  { family: "EB Garamond", file: "EBGaramond-Regular.ttf", category: "serif" },
  { family: "Libre Baskerville", file: "LibreBaskerville-Regular.ttf", category: "serif" },
  // Sans-serif — modern, clean
  { family: "Montserrat", file: "Montserrat-Regular.ttf", category: "sans" },
  { family: "Poppins", file: "Poppins-Regular.ttf", category: "sans" },
  { family: "Raleway", file: "Raleway-Regular.ttf", category: "sans" },
  { family: "Open Sans", file: "OpenSans-Regular.ttf", category: "sans" },
  { family: "Lato", file: "Lato-Regular.ttf", category: "sans" },
];

/** Just the family names, for the picker. */
export const BUNDLED_FONT_FAMILIES: string[] = BUNDLED_FONTS.map((f) => f.family);

/** Case-insensitive lookup of a bundled font by family name. */
export function findBundledFont(family: string): BundledFont | undefined {
  const key = family.trim().toLowerCase();
  return BUNDLED_FONTS.find((f) => f.family.toLowerCase() === key);
}
