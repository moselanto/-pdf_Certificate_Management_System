"use client";

// Client wrapper around TemplateDesigner. Responsibilities:
//   1. Rasterize the template's front PDF into a PNG backdrop (pdf.js).
//   2. Load any saved placeholders for this template.
//   3. Persist placeholders via PUT /api/templates/[id]/placeholders.

import { useEffect, useState } from "react";
import { TemplateDesigner } from "@/components/TemplateDesigner";
import { rasterizeFirstPage } from "@/lib/pdf/rasterize";
import type { Placeholder } from "@/lib/domain/types";

interface Props {
  templateId: string;
  frontPdfUrl: string;
  pageWidth: number;
  pageHeight: number;
}

export function TemplateDesignerClient({
  templateId,
  frontPdfUrl,
  pageWidth,
  pageHeight,
}: Props) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<Placeholder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rasterize the backdrop once.
  useEffect(() => {
    let cancelled = false;
    if (!frontPdfUrl) {
      setError("Could not load the template PDF.");
      return;
    }
    rasterizeFirstPage(frontPdfUrl)
      .then((r) => {
        if (!cancelled) setPageImageUrl(r.dataUrl);
      })
      .catch((e) => !cancelled && setError(`Failed to render template: ${e.message}`));
    return () => {
      cancelled = true;
    };
  }, [frontPdfUrl]);

  // Load saved placeholders.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/templates/${templateId}/placeholders`)
      .then((r) => r.json())
      .then((j) => !cancelled && setPlaceholders(j.placeholders ?? []))
      .catch(() => !cancelled && setPlaceholders([]));
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const save = async (next: Placeholder[]) => {
    const res = await fetch(`/api/templates/${templateId}/placeholders`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeholders: next }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Save failed");
    }
  };

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }
  if (!pageImageUrl || placeholders === null) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Loading designer…
      </div>
    );
  }

  return (
    <TemplateDesigner
      templateId={templateId}
      pageImageUrl={pageImageUrl}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      initialPlaceholders={placeholders}
      onSave={save}
    />
  );
}
