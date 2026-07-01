"use client";

// ============================================================================
// PlaceholderEditor — drag-and-drop positioning of fields over a template page.
//
// The page raster is shown as a background image. Each placeholder is an
// absolutely-positioned, draggable chip. Coordinates are PDF points, TOP-LEFT
// origin — identical to the pdf-lib engine, which converts to bottom-left at
// render time. The inner stage is sized to EXACTLY pageWidth*scale x
// pageHeight*scale (object-fill image) so on-screen pixels map 1:1 to the
// printed PDF on BOTH axes. A live X/Y readout + "Center on page" button make
// placement exact and verifiable.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Placeholder } from "@/lib/domain/types";

interface Props {
  pageImageUrl: string;
  pageWidth: number;
  pageHeight: number;
  placeholders: Placeholder[];
  onChange: (next: Placeholder[]) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
  // Optional overlay rendered inside the stage, on top of the backdrop but
  // aligned to the SAME scale. Used by the "from scratch" drawing mode to draw
  // design elements (text/line/rect) on the same canvas. Receives the computed
  // px-per-point scale so it maps 1:1 with placeholders.
  renderOverlay?: (scale: number) => React.ReactNode;
  // When true, placeholder chips ignore pointer events so the overlay (drawing
  // layer) can receive clicks/drags. Placeholders still render for reference.
  overlayCaptures?: boolean;
}

export function PlaceholderEditor({
  pageImageUrl,
  pageWidth,
  pageHeight,
  placeholders,
  onChange,
  selectedId,
  onSelect,
  renderOverlay,
  overlayCaptures = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  // The page's TRUE aspect ratio (height/width) taken from the loaded raster's
  // natural pixel size. Relying on the passed pageWidth/pageHeight was wrong
  // when they didn't match the actual back-page raster, so positions mapped to
  // the wrong place. The raster never lies about its own shape.
  const [imgAspect, setImgAspect] = useState<number | null>(null);

  // Measure the stable wrapper width (never changes when the inner stage
  // resizes).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWrapWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Capture the raster's natural aspect ratio once it loads (and reset when the
  // backdrop image changes, e.g. switching Front/Back).
  useEffect(() => {
    setImgAspect(null);
  }, [pageImageUrl]);

  const onImgLoad = () => {
    const im = imgRef.current;
    if (im && im.naturalWidth > 0) {
      setImgAspect(im.naturalHeight / im.naturalWidth);
    }
  };

  // Horizontal scale: px per point from the measured width. Vertical uses the
  // SAME scale (uniform), and we size the stage height from the raster's real
  // aspect ratio so on-screen pixels map 1:1 to the printed page on both axes.
  const scale = wrapWidth > 0 ? wrapWidth / pageWidth : 1;
  const stageWidth = wrapWidth > 0 ? pageWidth * scale : 0;
  // Prefer the raster's true aspect; fall back to the passed page size.
  const stageHeight =
    stageWidth > 0
      ? imgAspect != null
        ? stageWidth * imgAspect
        : pageHeight * scale
      : 0;

  const onPointerDown = (e: React.PointerEvent, ph: Placeholder) => {
    e.preventDefault();
    onSelect?.(ph.id);
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

  // Center the selected field on the page. For the course list (top-left
  // anchored block) we offset upward by a rough block height so the BLOCK looks
  // centered, not its first line.
  const centerSelected = () => {
    if (!selectedId) return;
    onChange(
      placeholders.map((p) => {
        if (p.id !== selectedId) return p;
        if (p.kind === "course_list") {
          // Put the list's top a bit above the vertical middle.
          return { ...p, x: Math.round(pageWidth / 2), y: Math.round(pageHeight * 0.32), align: "center" };
        }
        return { ...p, x: Math.round(pageWidth / 2), y: Math.round(pageHeight / 2) };
      }),
    );
  };

  const anchorTransform = (ph: Placeholder) => {
    if (ph.kind === "qr" || ph.kind === "image" || ph.kind === "signature") {
      return "translate(0, 0)";
    }
    if (ph.kind === "course_list") return "translate(0, 0)";
    if (ph.align === "center") return "translate(-50%, 0)";
    if (ph.align === "right") return "translate(-100%, 0)";
    return "translate(0, 0)";
  };

  const selected = placeholders.find((p) => p.id === selectedId);

  return (
    <div className="w-full">
      <div ref={wrapRef} className="w-full">
        <div
          className="relative mx-auto select-none rounded-lg border border-gray-300 bg-gray-50 shadow-sm"
          style={{
            width: stageWidth > 0 ? stageWidth : "100%",
            height: stageHeight > 0 ? stageHeight : undefined,
            aspectRatio: stageWidth > 0 ? undefined : `${pageWidth} / ${pageHeight}`,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={pageImageUrl}
            alt="Template page"
            onLoad={onImgLoad}
            className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-fill"
            draggable={false}
          />

          {/* Center guide lines (faint) to help judge placement. */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-brand-300/40" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-brand-300/40" />

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
                  fontSize: isImage ? undefined : Math.max(9, ph.fontSize * scale),
                  width: isImage && ph.width ? ph.width * scale : undefined,
                  height: isImage && ph.height ? ph.height * scale : undefined,
                  padding: ph.kind === "course_list" ? 0 : undefined,
                  boxShadow: ph.kind === "course_list" ? "none" : undefined,
                  lineHeight: ph.kind === "course_list" ? 1 : undefined,
                }}
                title={`${ph.label} (${ph.kind}) — x:${ph.x} y:${ph.y}`}
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

          {/* Optional design-element overlay (from-scratch drawing mode). It
              receives the same scale so its elements map 1:1 with placeholders.
              When it captures pointer events, it sits above the chips. */}
          {renderOverlay && scale > 0 && (
            <div
              className="absolute inset-0"
              style={{ pointerEvents: overlayCaptures ? "auto" : "none" }}
            >
              {renderOverlay(scale)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>
          Page: {pageWidth.toFixed(0)} × {pageHeight.toFixed(0)} pt
        </span>
        {selected && (
          <span className="font-mono text-gray-700">
            {selected.label}: x {selected.x}, y {selected.y}
          </span>
        )}
        <button
          type="button"
          onClick={centerSelected}
          disabled={!selectedId}
          className="rounded-lg border border-gray-300 px-2.5 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Center selected on page
        </button>
        <span className="text-gray-400">
          Drag to position. The faint cross marks the page center.
        </span>
      </div>
    </div>
  );
}
