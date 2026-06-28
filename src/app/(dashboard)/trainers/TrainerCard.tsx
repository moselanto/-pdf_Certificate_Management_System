"use client";

// Trainer card with Edit (open detail/signature) + Delete actions, matching
// the template card pattern. Shows signature status and (if present) a small
// signature preview.

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface TrainerCardData {
  id: string;
  name: string;
  title: string | null;
  hasSignature: boolean;
}

export function TrainerCard({ trainer }: { trainer: TrainerCardData }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => router.push(`/trainers/${trainer.id}`);

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete trainer "${trainer.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainers/${trainer.id}`, { method: "DELETE" });
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
      <button onClick={openEditor} className="flex flex-1 items-start gap-3 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
          {trainer.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
            {trainer.name}
          </h3>
          {trainer.title && <p className="text-xs text-gray-500">{trainer.title}</p>}
          <p className="mt-2 text-xs font-medium">
            {trainer.hasSignature ? (
              <span className="text-green-600">Signature uploaded</span>
            ) : (
              <span className="text-amber-600">No signature yet</span>
            )}
          </p>
        </div>
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
