"use client";

// ============================================================================
// PlaceholderEditor — drag-and-drop positioning of fields over a template page.
//
// The template page is rendered as a background image (a PNG raster of the
// uploaded PDF, produced server-side or via pdf.js). Each placeholder is an
// absolutely-positioned, draggable chip. Coordinates are kept in PDF points
// with a TOP-LEFT origin — exactly what the overlay engine expects — so what
// the admin sees is what the generated PDF gets.
// ============================================================================

import { useCallback, useRef, useState } from "react";
import type { Placeholder } from "@/lib/domain/types";

interface Props {
  /** Background raster of the template page (data URL or storage URL). */
  pageImageUrl: string;
  /** True page size in PDF points (from readTemplatePageSize). */
  pageWidth: number;
  pageHeight: number;
  placeholders: Placeholder[];
  onChange: (next: Placeholder[]) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function PlaceholderEditor({
  pageImageUrl,
  pageWidth,
  pageHeight,
  placeholders,
  onChange,
  selectedId,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [renderWidth, setRenderWidth] = useState(0);

  // Scale factor: rendered pixels per PDF point.
  const scale = renderWidth > 0 ? renderWidth / pageWidth : 1;

  const onPointerDown = (e: React.PointerEvent, ph: Placeholder) => {
    e.preventDefault();
    onSelect?.(ph.id);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    dragState.current = {
      id: ph.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragState.current;
      const canvas = canvasRef.current;
      if (!ds || !canvas) return;
      const bounds = canvas.getBoundingClientRect();

      // Pixel position within the canvas, then convert to PDF points.
      const px = e.clientX - bounds.left - ds.offsetX;
      const py = e.clientY - bounds.top - ds.offsetY;
      const xPts = Math.max(0, Math.min(pageWidth, px / scale));
      const yPts = Math.max(0, Math.min(pageHeight, py / scale));

      onChange(
        placeholders.map((p) =>
          p.id === ds.id ? { ...p, x: Math.round(xPts), y: Math.round(yPts) } : p,
        ),
      );
    },
    [onChange, placeholders, pageHeight, pageWidth, scale],
  );

  const onPointerUp = () => {
    dragState.current = null;
  };

  return (
    <div className="w-full">
      <div
        ref={(el) => {
          canvasRef.current = el;
          if (el) setRenderWidth(el.clientWidth);
        }}
        className="relative w-full select-none rounded-lg border border-gray-300 bg-gray-50 shadow-sm"
        style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pageImageUrl}
          alt="Template page"
          className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-contain"
          draggable={false}
        />

        {placeholders.map((ph) => {
          const isSelected = ph.id === selectedId;
          return (
            <div
              key={ph.id}
              onPointerDown={(e) => onPointerDown(e, ph)}
              className={[
                "absolute cursor-move whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium shadow",
                isSelected
                  ? "bg-brand-600 text-white ring-2 ring-brand-700"
                  : "bg-white/90 text-gray-800 ring-1 ring-gray-300",
              ].join(" ")}
              style={{
                left: ph.x * scale,
                top: ph.y * scale,
                fontSize: Math.max(9, ph.fontSize * scale * 0.7),
              }}
              title={`${ph.label} (${ph.kind})`}
            >
              {ph.kind === "qr"
                ? "QR"
                : ph.kind === "signature"
                ? "Signature"
                : ph.label}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Drag any field to position it. Coordinates are saved in PDF points
        ({pageWidth.toFixed(0)} × {pageHeight.toFixed(0)} pt), so the live
        preview matches the printed certificate exactly.
      </p>
    </div>
  );
}
