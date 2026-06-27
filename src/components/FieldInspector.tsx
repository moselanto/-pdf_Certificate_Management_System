"use client";

// Side panel to edit the properties of the selected placeholder.
import type { Placeholder, PlaceholderKind, TextAlign } from "@/lib/domain/types";

interface Props {
  placeholder?: Placeholder;
  onChange: (next: Placeholder) => void;
  onDelete: (id: string) => void;
}

const KINDS: PlaceholderKind[] = ["text", "date", "qr", "image", "signature"];
const ALIGNS: TextAlign[] = ["left", "center", "right"];
const FONTS = ["Helvetica", "Helvetica-Bold", "Times", "Courier"];

export function FieldInspector({ placeholder, onChange, onDelete }: Props) {
  if (!placeholder) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        Select a field on the certificate to edit its properties, or add a new
        field from the toolbar.
      </div>
    );
  }
  const p = placeholder;
  const set = (patch: Partial<Placeholder>) => onChange({ ...p, ...patch });

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600">Label</label>
        <input
          className="mt-1 w-full rounded border-gray-300 text-sm"
          value={p.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600">Field key</label>
        <input
          className="mt-1 w-full rounded border-gray-300 font-mono text-sm"
          value={p.fieldKey}
          onChange={(e) => set({ fieldKey: e.target.value })}
          placeholder="recipient_name"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600">Type</label>
          <select
            className="mt-1 w-full rounded border-gray-300 text-sm"
            value={p.kind}
            onChange={(e) => set({ kind: e.target.value as PlaceholderKind })}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600">Page</label>
          <select
            className="mt-1 w-full rounded border-gray-300 text-sm"
            value={p.page}
            onChange={(e) => set({ page: e.target.value as "front" | "back" })}
          >
            <option value="front">front</option>
            <option value="back">back</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600">X (pt)</label>
          <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
            value={p.x} onChange={(e) => set({ x: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600">Y (pt)</label>
          <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
            value={p.y} onChange={(e) => set({ y: Number(e.target.value) })} />
        </div>
      </div>

      {(p.kind === "text" || p.kind === "date") && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Font size</label>
              <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Color</label>
              <input type="color" className="mt-1 h-9 w-full rounded border-gray-300"
                value={p.color} onChange={(e) => set({ color: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Font</label>
              <select className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Align</label>
              <select className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.align} onChange={(e) => set({ align: e.target.value as TextAlign })}>
                {ALIGNS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </>
      )}

      {(p.kind === "qr" || p.kind === "image" || p.kind === "signature") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600">Width (pt)</label>
            <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
              value={p.width ?? 96} onChange={(e) => set({ width: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">Height (pt)</label>
            <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
              value={p.height ?? 96} onChange={(e) => set({ height: Number(e.target.value) })} />
          </div>
        </div>
      )}

      <button
        onClick={() => onDelete(p.id)}
        className="w-full rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Delete field
      </button>
    </div>
  );
}
