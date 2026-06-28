"use client";

// A single template card. The thumbnail shows the uploaded front PDF directly
// in an <iframe> using the browser's built-in PDF viewer — no pdf.js / worker,
// so it works reliably everywhere (including Codespaces). Edit opens the
// designer; Delete removes the template.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface TemplateCardData {
  id: string;
  name: string;
  hasBack: boolean;
  pageWidth?: number | null;
  pageHeight?: number | null;
}

export function TemplateCard({ template }: { template: TemplateCardData }) {
  const router = useRouter();
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

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
        if (!cancelled) setFrontUrl(url);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  const openEditor = () => router.push(`/templates/${template.id}`);

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

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm">
      {/* Thumbnail — PDF first page via the browser's native viewer */}
      <div
        className="relative h-40 cursor-pointer overflow-hidden bg-gray-100"
        onClick={openEditor}
        title="Open designer"
      >
        {frontUrl ? (
          <>
            <iframe
              src={`${frontUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
              title={template.name}
              className="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50 border-0"
            />
            {/* Transparent overlay so clicks open the editor, not the PDF */}
            <div className="absolute inset-0" />
          </>
        ) : failed ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            Preview unavailable
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            Loading preview…
          </div>
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
