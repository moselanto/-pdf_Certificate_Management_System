"use client";

// Add, edit, reorder, and remove a course's units/competencies. Order is the
// array order; the API derives sort_order from position so reordering is
// effortless. Uses native HTML5 drag-and-drop to keep dependencies minimal.

import { useState } from "react";

interface Unit {
  title: string;
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setUnits((u) => [...u, { title: t }]);
    setDraft("");
  };

  const remove = (i: number) => setUnits((u) => u.filter((_, idx) => idx !== i));

  const edit = (i: number, title: string) =>
    setUnits((u) => u.map((unit, idx) => (idx === i ? { title } : unit)));

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

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: units.filter((u) => u.title.trim()) }),
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

      <ul className="space-y-2">
        {units.map((u, i) => (
          <li
            key={i}
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
        ))}
        {units.length === 0 && (
          <li className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-400">
            No units yet. Add the first competency below.
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
