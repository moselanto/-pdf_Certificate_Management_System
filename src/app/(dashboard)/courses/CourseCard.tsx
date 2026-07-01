"use client";

// Course card with Edit (open editor) + Delete actions, matching the template
// card pattern. Courses don't have a PDF, so we show a simple unit-count badge.

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface CourseCardData {
  id: string;
  title: string;
  description: string | null;
  unitCount: number;
}

export function CourseCard({ course }: { course: CourseCardData }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => router.push(`/courses/${course.id}`);

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete course "${course.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm">
      <button onClick={openEditor} className="flex-1 text-left">
        <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{course.description}</p>
        )}
        <p className="mt-3 text-xs font-medium text-brand-700">
          {course.unitCount} unit{course.unitCount === 1 ? "" : "s"}
        </p>
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={openEditor}
          className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
