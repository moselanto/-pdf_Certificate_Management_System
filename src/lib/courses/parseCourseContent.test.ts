import { describe, it, expect } from "vitest";
import { courseItemsToText, parseCourseContent } from "./parseCourseContent";

describe("parseCourseContent", () => {
  it("groups '- ' items under the preceding heading line", () => {
    const rows = parseCourseContent(
      ["Theory", "- Duty of Care", "- Safeguarding", "", "Practical", "- Basic Life Support"].join(
        "\n",
      ),
    );
    expect(rows).toEqual([
      { title: "Duty of Care", section: "Theory" },
      { title: "Safeguarding", section: "Theory" },
      { title: "Basic Life Support", section: "Practical" },
    ]);
  });

  it("treats items before any heading as having no section", () => {
    const rows = parseCourseContent("- Use of full body hoist\n- Use of stand aids");
    expect(rows).toEqual([
      { title: "Use of full body hoist" },
      { title: "Use of stand aids" },
    ]);
  });

  it("accepts hyphen, asterisk, bullet and check markers", () => {
    const rows = parseCourseContent("Group\n- a\n* b\n• c\n✓ d");
    expect(rows.map((r) => r.title)).toEqual(["a", "b", "c", "d"]);
    expect(rows.every((r) => r.section === "Group")).toBe(true);
  });

  it("ignores blank lines and trims whitespace", () => {
    const rows = parseCourseContent("\n   Theory   \n\n  -   Duty of Care  \n\n");
    expect(rows).toEqual([{ title: "Duty of Care", section: "Theory" }]);
  });

  it("round-trips through courseItemsToText and back", () => {
    const rows = [
      { title: "Duty of Care", section: "Theory" },
      { title: "Safeguarding", section: "Theory" },
      { title: "Basic Life Support", section: "Practical" },
    ];
    expect(parseCourseContent(courseItemsToText(rows))).toEqual(rows);
  });
});
