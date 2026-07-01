"use client";

// A single template card. The thumbnail embeds the front PDF directly via the
// /api/templates/[id]/thumb route (which 302-redirects to a signed PDF URL),
// rendered by the browser's built-in PDF viewer inside an <object>. No client
// fetch, no pdf.js, no worker — so it renders reliably (including Codespaces)
// and never gets stuck on a "Loading…" state.
//
// Actions: Edit (open designer), Archive/Unarchive (soft hide — used when a
// template has issued certificates and can't be deleted), and Delete (only
// succeeds when no certificates reference it).

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TemplateCardData {
  id: string;
  name: string;
  hasBack: boolean;
  pageWidth?: number | null;
  pageHeight?: number | null;
  archived?: boolean;
}

export function TemplateCard({ template }: { template: TemplateCardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "delete" | "archive">(null);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => router.push(`/templates/${template.id}`);

  const onArchiveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const archiving = !template.archived;
    if (
      archiving &&
      !confirm(
        `Archive template "${template.name}"?\n\nIt will be hidden from the active list and the Generate screen, but kept (with its certificates) intact. You can unarchive it anytime.`,
      )
    ) {
      return;
    }
    setBusy("archive");
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archiving }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Archive failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const thumbSrc = `/api/templates/${template.id}/thumb#toolbar=0&navpanes=0&scrollbar=0&view=Fit`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm">
      {/* Thumbnail — front PDF via the browser's native viewer */}
      <div
        className="relative h-40 cursor-pointer overflow-hidden bg-gray-100"
        onClick={openEditor}
        title="Open designer"
      >
        <object
          data={thumbSrc}
          type="application/pdf"
          className="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50"
          aria-label={`${template.name} preview`}
        >
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            PDF preview
          </div>
        </object>
        <div className="absolute inset-0" />
        {template.archived && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Archived
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
          {template.name}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {template.hasBack ? "Front + back" : "Front only"}
          {template.pageWidth && template.pageHeight
            ? ` · ${Math.round(template.pageWidth)} × ${Math.round(template.pageHeight)} pt`
            : ""}
        </p>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={openEditor}
            className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Edit
          </button>
          <button
            onClick={onArchiveToggle}
            disabled={busy !== null}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            {busy === "archive"
              ? "Saving…"
              : template.archived
                ? "Unarchive"
                : "Archive"}
          </button>
          <button
            onClick={onDelete}
            disabled={busy !== null}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {busy === "delete" ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
