"use client";

// Client wrapper around TemplateDesigner. Responsibilities:
//   1. Rasterize the template's front PDF (and back PDF, if present) into PNG
//      backdrops (pdf.js). FROM-SCRATCH templates have no PDF: we use a blank
//      white canvas backdrop instead.
//   2. Load any saved placeholders + design elements for this template.
//   3. Persist both via PUT /api/templates/[id]/placeholders.

import { useEffect, useState } from "react";
import { TemplateDesigner } from "@/components/TemplateDesigner";
import { rasterizeFirstPage } from "@/lib/pdf/rasterize";
import type { DesignElement, Placeholder } from "@/lib/domain/types";

interface Props {
  templateId: string;
  frontPdfUrl: string;
  backPdfUrl?: string;
  pageWidth: number;
  pageHeight: number;
  // FROM-SCRATCH templates have no PDF; the designer uses a blank canvas.
  isFromScratch?: boolean;
}

// A blank white page backdrop (SVG data URL) for from-scratch templates. The
// editor stretches it to the page aspect, matching the printed blank page.
function blankBackdrop(width: number, height: number) {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff" stroke="#e5e7eb"/></svg>`,
    )
  );
}

export function TemplateDesignerClient({
  templateId,
  frontPdfUrl,
  backPdfUrl,
  pageWidth,
  pageHeight,
  isFromScratch = false,
}: Props) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(
    isFromScratch ? blankBackdrop(pageWidth, pageHeight) : null,
  );
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  // Back page can be a DIFFERENT size than the front. We capture its real
  // dimensions from the rasterizer so the editor scales the back canvas to the
  // back page — otherwise fields placed on the back drift vertically because
  // the engine uses the back page's true height.
  const [backSize, setBackSize] = useState<{ width: number; height: number } | null>(null);
  const [placeholders, setPlaceholders] = useState<Placeholder[] | null>(null);
  const [designElements, setDesignElements] = useState<DesignElement[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Rasterize the front backdrop once (PDF templates only). From-scratch
  // templates keep the blank backdrop set in initial state.
  useEffect(() => {
    if (isFromScratch) return;
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
  }, [frontPdfUrl, isFromScratch]);

  // Rasterize the back backdrop, if a back PDF exists. Best-effort: failure
  // just leaves the back canvas blank (the toggle still works). We also capture
  // the back page's real point dimensions for correct back-page scaling.
  useEffect(() => {
    let cancelled = false;
    if (!backPdfUrl) {
      setBackImageUrl(null);
      setBackSize(null);
      return;
    }
    rasterizeFirstPage(backPdfUrl)
      .then((r) => {
        if (!cancelled) {
          setBackImageUrl(r.dataUrl);
          setBackSize({ width: r.widthPt, height: r.heightPt });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackImageUrl(null);
          setBackSize(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [backPdfUrl]);

  // Load saved placeholders + design elements.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/templates/${templateId}/placeholders`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setPlaceholders(j.placeholders ?? []);
        setDesignElements(Array.isArray(j.designElements) ? j.designElements : []);
      })
      .catch(() => {
        if (cancelled) return;
        setPlaceholders([]);
        setDesignElements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const save = async (nextPlaceholders: Placeholder[], nextDesign: DesignElement[]) => {
    const res = await fetch(`/api/templates/${templateId}/placeholders`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeholders: nextPlaceholders, designElements: nextDesign }),
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
      backImageUrl={backImageUrl ?? undefined}
      hasBackPdf={Boolean(backPdfUrl)}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      backPageWidth={backSize?.width}
      backPageHeight={backSize?.height}
      initialPlaceholders={placeholders}
      initialDesignElements={designElements}
      onSave={save}
    />
  );
}
