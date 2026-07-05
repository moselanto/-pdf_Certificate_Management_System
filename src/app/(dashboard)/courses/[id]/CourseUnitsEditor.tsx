"use client";

// Add, edit, reorder, and remove a course's units/competencies — OR paste a
// whole "course content" page (headings + "- " items) at once. Order is the
// array order; the API derives sort_order from position so drag-reordering
// "just works". Units may carry an optional `section` grouping heading, which
// renders as a bold sub-heading over its own checklist on the back page.

import { Fragment, useState } from "react";
import {
  courseItemsToText,
  parseCourseContent,
} from "@/lib/courses/parseCourseContent";

interface Unit {
  title: string;
  section?: string;
}

export function CourseUnitsEditor({
  courseId,
  initialUnits,
}: {
  courseId: string;
  initialUnits: Unit[];
}) {
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [draft, setDraft] = useState("");
  const [pasteText, setPasteText] = useState(() => courseItemsToText(initialUnits));
  const [showPaste, setShowPaste] = useState(false);
  // True when the paste box has text the user has typed but not yet turned into
  // units via "Apply to list". Saving will apply it automatically so pasting +
  // Save "just works" without the extra click (the old trap that saved an empty
  // list and produced a blank certificate back page).
  const [pasteDirty, setPasteDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    // A quick-added unit inherits the last unit's section so it stays in the
    // current group.
    setUnits((u) => [...u, { title: t, section: u[u.length - 1]?.section }]);
    setDraft("");
  };

  const remove = (i: number) => setUnits((u) => u.filter((_, idx) => idx !== i));

  const edit = (i: number, title: string) =>
    setUnits((u) => u.map((unit, idx) => (idx === i ? { ...unit, title } : unit)));

  const onDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    setUnits((u) => {
      const next = [...u];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIndex(null);
  };

  const applyPaste = () => {
    setUnits(parseCourseContent(pasteText));
    setPasteDirty(false);
    setShowPaste(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    // If the paste box holds text that was typed but never "applied", treat it
    // as the source of truth so a plain paste + Save persists the content. We
    // also reflect it in the visible list so the user sees exactly what saved.
    const source = pasteDirty ? parseCourseContent(pasteText) : units;
    if (pasteDirty) {
      setUnits(source);
      setPasteDirty(false);
    }
    try {
      const res = await fetch(`/api/courses/${courseId}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: source
            .filter((u) => u.title.trim())
            .map((u) => ({
              title: u.title,
              ...(u.section ? { section: u.section } : {}),
            })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Units / competencies
        </h3>
        <span className="text-xs text-gray-400">{units.length} total</span>
      </div>

      {/* Paste a whole page of content (headings + "- " items) at once. */}
      <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
        <button
          onClick={() => setShowPaste((s) => !s)}
          className="text-sm font-semibold text-brand-700"
        >
          {showPaste ? "▾ " : "▸ "}Paste full page (headings + items)
        </button>
        {showPaste && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-gray-600">
              A line on its own is a{" "}
              <span className="font-semibold">section heading</span> (e.g.
              Theory, Practical). A line starting with{" "}
              <span className="font-mono">- </span> is a{" "}
              <span className="font-semibold">checklist item</span>. Blank lines
              are spacing. Applying replaces the list below — or just click{" "}
              <span className="font-semibold">Save units</span> and this text
              will be applied automatically.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                setPasteDirty(true);
              }}
              rows={10}
              placeholder={
                "Theory\n- Duty of Care\n- Safeguarding Adults and Children\n\nPractical\n- Basic Life Support\n- Moving and Handling"
              }
              className="w-full rounded-lg border border-gray-300 p-2 font-mono text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={applyPaste}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Apply to list
            </button>
            {pasteDirty && (
              <p className="text-xs font-medium text-amber-600">
                Un-applied text — it will be applied when you click Save units.
              </p>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {units.map((u, i) => {
          const prev = units[i - 1];
          const showHeader = (u.section ?? "") !== (prev?.section ?? "");
          return (
            <Fragment key={i}>
              {showHeader && u.section && (
                <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {u.section}
                </li>
              )}
              <li
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <span className="cursor-move text-gray-400" title="Drag to reorder">
                  ⋮⋮
                </span>
                <span className="w-6 text-xs text-gray-400">{i + 1}.</span>
                <input
                  value={u.title}
                  onChange={(e) => edit(i, e.target.value)}
                  className="flex-1 rounded border-gray-200 bg-white text-sm"
                />
                <button
                  onClick={() => remove(i)}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            </Fragment>
          );
        })}
        {units.length === 0 && (
          <li className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-400">
            No units yet. Add the first competency below, or paste a full page above.
          </li>
        )}
      </ul>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. Data Entry Accuracy & Speed"
          className="flex-1 rounded-lg border-gray-300 text-sm"
        />
        <button
          onClick={add}
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          + Add unit
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save units"}
        </button>
        {savedAt && <span className="text-xs text-green-600">Saved at {savedAt}</span>}
      </div>
    </div>
  );
}
