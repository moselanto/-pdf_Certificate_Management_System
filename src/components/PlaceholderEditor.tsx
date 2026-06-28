"use client";

// ============================================================================
// PlaceholderEditor — drag-and-drop positioning of fields over a template page.
//
// The template page is rendered as a background image (a PNG raster of the
// uploaded PDF). Each placeholder is an absolutely-positioned, draggable chip.
// Coordinates are kept in PDF points with a TOP-LEFT origin.
//
// ALIGNMENT (must match the pdf-lib engine in src/lib/pdf/overlay.ts):
//   - align "left":   ph.x is the LEFT edge of the text
//   - align "center": ph.x is the CENTER of the text
//   - align "right":  ph.x is the RIGHT edge of the text
// We anchor each chip at ph.x and use a CSS translateX to shift it so the chip
// previews text the same way the generated PDF draws it. This keeps "what you
// see" equal to "what you print".
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
  const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [renderWidth, setRenderWidth] = useState(0);

  // Scale factor: rendered pixels per PDF point.
  const scale = renderWidth > 0 ? renderWidth / pageWidth : 1;

  const onPointerDown = (e: React.PointerEvent, ph: Placeholder) => {
    e.preventDefault();
    onSelect?.(ph.id);
    // Track the pointer's start position and the field's original point coords,
    // so dragging moves the anchor (ph.x) by the same delta regardless of which
    // part of the chip you grabbed. This avoids alignment-dependent jumps.
    dragState.current = {
      id: ph.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: ph.x,
      origY: ph.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragState.current;
      if (!ds || scale === 0) return;

      // Convert the pixel delta to a point delta and apply to the anchor.
      const dxPts = (e.clientX - ds.startX) / scale;
      const dyPts = (e.clientY - ds.startY) / scale;
      const xPts = Math.max(0, Math.min(pageWidth, ds.origX + dxPts));
      const yPts = Math.max(0, Math.min(pageHeight, ds.origY + dyPts));

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

  // CSS transform that mirrors the engine's alignment anchoring.
  const anchorTransform = (ph: Placeholder) => {
    if (ph.kind === "qr" || ph.kind === "image" || ph.kind === "signature") {
      return "translate(0, 0)"; // images anchor at top-left like the engine
    }
    if (ph.align === "center") return "translate(-50%, 0)";
    if (ph.align === "right") return "translate(-100%, 0)";
    return "translate(0, 0)"; // left
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
          const isImage = ph.kind === "qr" || ph.kind === "image" || ph.kind === "signature";
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
                transform: anchorTransform(ph),
                transformOrigin: "top left",
                // Preview images at their real box size; text at its font size.
                fontSize: isImage ? undefined : Math.max(9, ph.fontSize * scale),
                width: isImage && ph.width ? ph.width * scale : undefined,
                height: isImage && ph.height ? ph.height * scale : undefined,
              }}
              title={`${ph.label} (${ph.kind}) — align: ${ph.align}`}
            >
              {ph.kind === "qr"
                ? "QR"
                : ph.kind === "signature"
                ? "Signature"
                : ph.kind === "image"
                ? "Image"
                : ph.kind === "course_list"
                ? "Course list ▤"
                : ph.label}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Drag any field to position it. For centered/right-aligned text, the
        chip anchors the same way the printed PDF does, so the preview matches
        the output. Page size: {pageWidth.toFixed(0)} × {pageHeight.toFixed(0)} pt.
      </p>
    </div>
  );
}
