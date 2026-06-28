"use client";

// A single template card: shows a rasterized thumbnail of the uploaded front
// PDF (via pdf.js), with Edit (open designer) and Delete actions.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rasterizeFirstPage } from "@/lib/pdf/rasterize";

export interface TemplateCardData {
  id: string;
  name: string;
  hasBack: boolean;
  pageWidth?: number | null;
  pageHeight?: number | null;
}

export function TemplateCard({ template }: { template: TemplateCardData }) {
  const router = useRouter();
  const [thumb, setThumb] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  // Fetch a signed URL for the front PDF, then rasterize its first page.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${template.id}`);
        const json = await res.json();
        const url = json?.template?.frontUrl as string | null;
        if (!url) throw new Error("no url");
        const r = await rasterizeFirstPage(url, 1.2);
        if (!cancelled) setThumb(r.dataUrl);
      } catch {
        if (!cancelled) setThumbError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  const openEditor = () => router.push(`/templates/${template.id}`);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm">
      {/* Thumbnail */}
      <button
        onClick={openEditor}
        className="relative flex h-40 items-center justify-center overflow-hidden bg-gray-50"
        title="Open designer"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={template.name} className="h-full w-full object-contain" />
        ) : thumbError ? (
          <span className="text-xs text-gray-400">Preview unavailable</span>
        ) : (
          <span className="text-xs text-gray-400">Loading preview…</span>
        )}
      </button>

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

        <div className="mt-3 flex gap-2">
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
    </div>
  );
}
