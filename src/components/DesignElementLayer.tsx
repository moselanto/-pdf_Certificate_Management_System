"use client";

// ============================================================================
// DesignElementLayer — draws & edits STATIC design elements (text / line /
// rect) on the same page canvas the PlaceholderEditor uses. This powers the
// "from scratch" drawing mode: the designer draws artwork directly on a blank
// (or template) page.
//
// Coordinates are PDF points, TOP-LEFT origin — identical to the engine, which
// converts to pdf-lib's bottom-left at render time. On-screen we multiply by
// `scale` (px per point). The stage sizing/scale is owned by the parent (it is
// the same math PlaceholderEditor uses) and passed in.
//
// Interaction model:
//   • tool === "select": click an element to select; drag to move.
//   • tool === "text": click to drop a new text element at that point.
//   • tool === "line": press-drag to draw a straight line (start -> end).
//   • tool === "rect": press-drag to draw a rectangle (corner -> corner).
// The parent owns the elements array + selection and passes callbacks.
// ============================================================================

import { useCallback, useRef } from "react";
import type {
  DesignElement,
  DesignLineElement,
  DesignRectElement,
  DesignTextElement,
} from "@/lib/domain/types";

export type DrawTool = "select" | "text" | "line" | "rect";

interface Props {
  scale: number; // px per point
  pageWidth: number; // points
  pageHeight: number; // points
  elements: DesignElement[]; // active-page elements only
  tool: DrawTool;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onChange: (next: DesignElement[]) => void;
  onCreate: (el: DesignElement) => void;
  onToolConsumed: () => void; // parent resets tool -> "select" after a create
}

let dcounter = 0;
const newId = () => `de_${Date.now()}_${dcounter++}`;

export function DesignElementLayer({
  scale,
  pageWidth,
  pageHeight,
  elements,
  tool,
  selectedId,
  onSelect,
  onChange,
  onCreate,
  onToolConsumed,
}: Props) {
  // Drag state for MOVING an existing element.
  const moveState = useRef<
    | {
        id: string;
        startX: number;
        startY: number;
        orig: DesignElement;
      }
    | null
  >(null);

  // Draw state for CREATING a line/rect by press-dragging.
  const drawState = useRef<
    | {
        kind: "line" | "rect";
        startXpt: number;
        startYpt: number;
        id: string;
      }
    | null
  >(null);

  // Convert a pointer event to page-point coordinates relative to the stage.
  const toPoints = useCallback(
    (e: React.PointerEvent, stage: HTMLElement) => {
      const rect = stage.getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const yPx = e.clientY - rect.top;
      const x = Math.max(0, Math.min(pageWidth, xPx / scale));
      const y = Math.max(0, Math.min(pageHeight, yPx / scale));
      return { x: Math.round(x), y: Math.round(y) };
    },
    [pageWidth, pageHeight, scale],
  );

  // --- Stage-level pointer handlers (create tools) -------------------------
  const onStagePointerDown = (e: React.PointerEvent) => {
    const stage = e.currentTarget as HTMLElement;
    if (tool === "select") return; // selection handled per-element
    const { x, y } = toPoints(e, stage);

    if (tool === "text") {
      const el: DesignTextElement = {
        id: newId(),
        page: "front", // parent overrides with the active page
        kind: "text",
        x,
        y,
        text: "New text",
        fontSize: 24,
        fontFamily: "Helvetica",
        color: "#111111",
        align: "left",
      };
      onCreate(el);
      onToolConsumed();
      return;
    }

    if (tool === "line" || tool === "rect") {
      drawState.current = { kind: tool, startXpt: x, startYpt: y, id: newId() };
      stage.setPointerCapture(e.pointerId);
    }
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    // Moving an existing element.
    const ms = moveState.current;
    if (ms) {
      const dxPts = (e.clientX - ms.startX) / scale;
      const dyPts = (e.clientY - ms.startY) / scale;
      onChange(
        elements.map((el) => {
          if (el.id !== ms.id) return el;
          if (el.kind === "line") {
            const orig = ms.orig as DesignLineElement;
            const dx = orig.x2 - orig.x;
            const dy = orig.y2 - orig.y;
            const nx = clamp(orig.x + dxPts, pageWidth);
            const ny = clamp(orig.y + dyPts, pageHeight);
            return { ...orig, x: r(nx), y: r(ny), x2: r(nx + dx), y2: r(ny + dy) };
          }
          const nx = clamp(ms.orig.x + dxPts, pageWidth);
          const ny = clamp(ms.orig.y + dyPts, pageHeight);
          return { ...el, x: r(nx), y: r(ny) };
        }),
      );
      return;
    }

    // Drawing a new line/rect (live preview updates the in-progress element).
    const ds = drawState.current;
    if (ds) {
      const stage = e.currentTarget as HTMLElement;
      const { x, y } = toPoints(e, stage);
      const exists = elements.some((el) => el.id === ds.id);
      if (ds.kind === "line") {
        const el: DesignLineElement = {
          id: ds.id,
          page: "front",
          kind: "line",
          x: ds.startXpt,
          y: ds.startYpt,
          x2: x,
          y2: y,
          thickness: 2,
          color: "#111111",
        };
        onChange(exists ? elements.map((e2) => (e2.id === ds.id ? el : e2)) : [...elements, el]);
      } else {
        const x0 = Math.min(ds.startXpt, x);
        const y0 = Math.min(ds.startYpt, y);
        const el: DesignRectElement = {
          id: ds.id,
          page: "front",
          kind: "rect",
          x: x0,
          y: y0,
          width: Math.abs(x - ds.startXpt),
          height: Math.abs(y - ds.startYpt),
          strokeColor: "#111111",
          strokeWidth: 2,
        };
        onChange(exists ? elements.map((e2) => (e2.id === ds.id ? el : e2)) : [...elements, el]);
      }
    }
  };

  const onStagePointerUp = () => {
    if (drawState.current) {
      const created = elements.find((el) => el.id === drawState.current!.id);
      drawState.current = null;
      if (created) {
        onSelect(created.id);
        onToolConsumed();
      }
    }
    moveState.current = null;
  };

  // --- Per-element move handler (select tool) ------------------------------
  const onElementPointerDown = (e: React.PointerEvent, el: DesignElement) => {
    if (tool !== "select") return;
    e.stopPropagation();
    onSelect(el.id);
    moveState.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: el,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: tool === "select" ? "default" : "crosshair" }}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
    >
      {elements.map((el) => {
        const isSel = el.id === selectedId;
        const ring = isSel ? "ring-2 ring-brand-600" : "ring-1 ring-gray-300/70";

        if (el.kind === "text") {
          return (
            <div
              key={el.id}
              onPointerDown={(e) => onElementPointerDown(e, el)}
              className={`absolute whitespace-pre rounded px-0.5 ${ring} ${
                tool === "select" ? "cursor-move" : ""
              }`}
              style={{
                left: el.x * scale,
                top: el.y * scale,
                transform:
                  el.align === "center"
                    ? "translate(-50%,0)"
                    : el.align === "right"
                      ? "translate(-100%,0)"
                      : "none",
                transformOrigin: "top left",
                fontSize: Math.max(8, el.fontSize * scale),
                // Preview the chosen font live (faces loaded browser-side by
                // the designer). Falls back to a default if a face isn't
                // loaded, matching the PDF engine's own fallback.
                fontFamily: el.fontFamily || undefined,
                // Show bold live on the canvas (synthetic bold in the PDF).
                fontWeight: el.bold ? 700 : undefined,
                color: el.color,
                background: isSel ? "rgba(37,99,235,0.06)" : "transparent",
              }}
              title={`text — x:${el.x} y:${el.y}`}
            >
              {el.text || "(empty)"}
            </div>
          );
        }

        if (el.kind === "line") {
          // Render lines as an SVG overlay segment.
          const minX = Math.min(el.x, el.x2);
          const minY = Math.min(el.y, el.y2);
          const w = Math.abs(el.x2 - el.x);
          const h = Math.abs(el.y2 - el.y);
          return (
            <svg
              key={el.id}
              onPointerDown={(e) => onElementPointerDown(e, el)}
              className={`absolute ${tool === "select" ? "cursor-move" : ""}`}
              style={{
                left: (minX - 4) * scale,
                top: (minY - 4) * scale,
                width: (w + 8) * scale,
                height: (h + 8) * scale,
                overflow: "visible",
              }}
            >
              <line
                x1={(el.x - minX + 4) * scale}
                y1={(el.y - minY + 4) * scale}
                x2={(el.x2 - minX + 4) * scale}
                y2={(el.y2 - minY + 4) * scale}
                stroke={el.color}
                strokeWidth={Math.max(1, el.thickness * scale)}
                strokeLinecap="round"
              />
              {isSel && (
                <line
                  x1={(el.x - minX + 4) * scale}
                  y1={(el.y - minY + 4) * scale}
                  x2={(el.x2 - minX + 4) * scale}
                  y2={(el.y2 - minY + 4) * scale}
                  stroke="#2563eb"
                  strokeWidth={Math.max(3, el.thickness * scale + 3)}
                  strokeOpacity={0.25}
                  strokeLinecap="round"
                />
              )}
            </svg>
          );
        }

        // rect
        return (
          <div
            key={el.id}
            onPointerDown={(e) => onElementPointerDown(e, el)}
            className={`absolute ${ring} ${tool === "select" ? "cursor-move" : ""}`}
            style={{
              left: el.x * scale,
              top: el.y * scale,
              width: el.width * scale,
              height: el.height * scale,
              border: el.strokeColor
                ? `${Math.max(1, (el.strokeWidth ?? 1) * scale)}px solid ${el.strokeColor}`
                : undefined,
              background: el.fillColor ?? "transparent",
              borderRadius: el.cornerRadius ? el.cornerRadius * scale : undefined,
            }}
            title={`rect — x:${el.x} y:${el.y} ${el.width}×${el.height}`}
          />
        );
      })}
    </div>
  );
}

function clamp(v: number, max: number) {
  return Math.max(0, Math.min(max, v));
}
function r(v: number) {
  return Math.round(v);
}
