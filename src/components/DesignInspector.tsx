"use client";

// ============================================================================
// DesignInspector — properties panel for the selected design element
// (text / line / rect) in the "from scratch" drawing mode. Mirrors the
// FieldInspector pattern used for placeholders.
//
// The font picker lists the standard PDF fonts plus any custom fonts the org
// has uploaded (passed in via `customFonts`). Selecting a custom font sets the
// element's fontFamily to that family name; the engine resolves it via fontkit.
// ============================================================================

import type {
  DesignElement,
  DesignLineElement,
  DesignRectElement,
  DesignTextElement,
  TextAlign,
} from "@/lib/domain/types";

const STANDARD_FONTS = [
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Times-Roman",
  "Courier",
];

interface Props {
  element?: DesignElement;
  /** Custom font family names available to this org (from the fonts table). */
  customFonts?: string[];
  onChange: (next: DesignElement) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function DesignInspector({
  element,
  customFonts = [],
  onChange,
  onDelete,
  onDuplicate,
}: Props) {
  if (!element) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-400">
        Select an element to edit it, or pick a tool above to draw a new one.
      </div>
    );
  }

  const fontOptions = [...STANDARD_FONTS, ...customFonts];

  const num = (v: string, fallback = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold uppercase text-brand-700">
          {element.kind}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onDuplicate(element.id)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Duplicate
          </button>
          <button
            onClick={() => onDelete(element.id)}
            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {element.kind === "text" && (
        <TextFields
          el={element}
          fontOptions={fontOptions}
          inputCls={inputCls}
          Row={Row}
          num={num}
          onChange={onChange}
        />
      )}
      {element.kind === "line" && (
        <LineFields el={element} inputCls={inputCls} Row={Row} num={num} onChange={onChange} />
      )}
      {element.kind === "rect" && (
        <RectFields el={element} inputCls={inputCls} Row={Row} num={num} onChange={onChange} />
      )}

      {/* Shared position readout */}
      <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
        Position: x {Math.round(element.x)}, y {Math.round(element.y)} pt
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TextFields({
  el,
  fontOptions,
  inputCls,
  Row,
  num,
  onChange,
}: {
  el: DesignTextElement;
  fontOptions: string[];
  inputCls: string;
  Row: any;
  num: (v: string, f?: number) => number;
  onChange: (n: DesignElement) => void;
}) {
  return (
    <>
      <Row label="Text">
        <textarea
          value={el.text}
          rows={2}
          onChange={(e) => onChange({ ...el, text: e.target.value })}
          className={inputCls}
        />
      </Row>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Font">
          <select
            value={el.fontFamily}
            onChange={(e) => onChange({ ...el, fontFamily: e.target.value })}
            className={inputCls}
          >
            {fontOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Size (pt)">
          <input
            type="number"
            value={el.fontSize}
            onChange={(e) => onChange({ ...el, fontSize: num(e.target.value, 16) })}
            className={inputCls}
          />
        </Row>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Color">
          <input
            type="color"
            value={el.color}
            onChange={(e) => onChange({ ...el, color: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300"
          />
        </Row>
        <Row label="Align">
          <select
            value={el.align}
            onChange={(e) => onChange({ ...el, align: e.target.value as TextAlign })}
            className={inputCls}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Row>
      </div>
      <Row label="Wrap width (pt, optional)">
        <input
          type="number"
          value={el.width ?? ""}
          placeholder="no wrap"
          onChange={(e) =>
            onChange({ ...el, width: e.target.value ? num(e.target.value) : undefined })
          }
          className={inputCls}
        />
      </Row>
    </>
  );
}

function LineFields({
  el,
  inputCls,
  Row,
  num,
  onChange,
}: {
  el: DesignLineElement;
  inputCls: string;
  Row: any;
  num: (v: string, f?: number) => number;
  onChange: (n: DesignElement) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Thickness (pt)">
          <input
            type="number"
            value={el.thickness}
            onChange={(e) => onChange({ ...el, thickness: num(e.target.value, 1) })}
            className={inputCls}
          />
        </Row>
        <Row label="Color">
          <input
            type="color"
            value={el.color}
            onChange={(e) => onChange({ ...el, color: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300"
          />
        </Row>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="End X (pt)">
          <input
            type="number"
            value={el.x2}
            onChange={(e) => onChange({ ...el, x2: num(e.target.value) })}
            className={inputCls}
          />
        </Row>
        <Row label="End Y (pt)">
          <input
            type="number"
            value={el.y2}
            onChange={(e) => onChange({ ...el, y2: num(e.target.value) })}
            className={inputCls}
          />
        </Row>
      </div>
    </>
  );
}

function RectFields({
  el,
  inputCls,
  Row,
  num,
  onChange,
}: {
  el: DesignRectElement;
  inputCls: string;
  Row: any;
  num: (v: string, f?: number) => number;
  onChange: (n: DesignElement) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Width (pt)">
          <input
            type="number"
            value={el.width}
            onChange={(e) => onChange({ ...el, width: num(e.target.value) })}
            className={inputCls}
          />
        </Row>
        <Row label="Height (pt)">
          <input
            type="number"
            value={el.height}
            onChange={(e) => onChange({ ...el, height: num(e.target.value) })}
            className={inputCls}
          />
        </Row>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Border color">
          <input
            type="color"
            value={el.strokeColor ?? "#111111"}
            onChange={(e) => onChange({ ...el, strokeColor: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300"
          />
        </Row>
        <Row label="Border width (pt)">
          <input
            type="number"
            value={el.strokeWidth ?? 1}
            onChange={(e) => onChange({ ...el, strokeWidth: num(e.target.value, 1) })}
            className={inputCls}
          />
        </Row>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Fill color">
          <input
            type="color"
            value={el.fillColor ?? "#ffffff"}
            onChange={(e) => onChange({ ...el, fillColor: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300"
          />
        </Row>
        <Row label="Corner radius (pt)">
          <input
            type="number"
            value={el.cornerRadius ?? 0}
            onChange={(e) => onChange({ ...el, cornerRadius: num(e.target.value, 0) })}
            className={inputCls}
          />
        </Row>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={!!el.fillColor}
          onChange={(e) =>
            onChange({ ...el, fillColor: e.target.checked ? (el.fillColor ?? "#ffffff") : undefined })
          }
        />
        Fill interior (uncheck for transparent)
      </label>
    </>
  );
}
