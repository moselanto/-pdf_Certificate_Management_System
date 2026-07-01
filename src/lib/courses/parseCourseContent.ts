// ============================================================================
// parseCourseContent — turn a pasted "course content" block into an ordered
// list of { section, title } rows for the certificate back page.
//
// Deliberately simple rules a non-technical author can rely on:
//   • A line that starts with a bullet marker ("-", "*", "•" or "✓") is an
//     ITEM (a checklist entry).
//   • Any other non-empty line is a SECTION heading; the items that follow it
//     belong to that section until the next heading.
//   • Blank lines are ignored (visual spacing only).
//
// Items that appear before any heading have no section (undefined) — they
// render as a plain checklist, which is the original flat behaviour.
// ============================================================================

export interface ParsedCourseItem {
  title: string;
  section?: string;
}

// Leading bullet marker: hyphen, asterisk, bullet or check, followed by space.
const BULLET_RE = /^[-*•✓]\s+/;

/** Parse pasted text into ordered { section, title } rows. */
export function parseCourseContent(text: string): ParsedCourseItem[] {
  const out: ParsedCourseItem[] = [];
  let currentSection: string | undefined;
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue; // blank line = spacing only
    if (BULLET_RE.test(line)) {
      const title = line.replace(BULLET_RE, "").trim();
      if (title) {
        out.push(currentSection ? { title, section: currentSection } : { title });
      }
    } else {
      // A non-bulleted line starts a new section.
      currentSection = line;
    }
  }
  return out;
}

/**
 * Inverse of parseCourseContent: render ordered rows back into the paste
 * syntax, so the editor can pre-fill its textarea from already-saved units and
 * round-trip cleanly. A blank line separates each section group.
 */
export function courseItemsToText(items: ReadonlyArray<ParsedCourseItem>): string {
  const lines: string[] = [];
  let lastSection: string | undefined | null = null; // null = not started yet
  for (const it of items) {
    const section = it.section ?? undefined;
    if (section !== lastSection) {
      if (lines.length) lines.push(""); // spacer between groups
      if (section) lines.push(section);
      lastSection = section;
    }
    lines.push(`- ${it.title}`);
  }
  return lines.join("\n");
}
