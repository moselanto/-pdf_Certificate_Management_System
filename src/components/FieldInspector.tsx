"use client";

// Side panel to edit the properties of the selected placeholder.
import type { Placeholder, PlaceholderKind, TextAlign } from "@/lib/domain/types";

interface Props {
  placeholder?: Placeholder;
  onChange: (next: Placeholder) => void;
  onDelete: (id: string) => void;
}

const KINDS: PlaceholderKind[] = ["text", "date", "qr", "image", "signature", "course_list"];
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
  const isBox = p.kind === "qr" || p.kind === "image" || p.kind === "signature";
  const isCourseList = p.kind === "course_list";

  // Keep QR square when resizing via the slider.
  const resizeSquare = (size: number) => set({ width: size, height: size });

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

      {isCourseList && (
        <div className="space-y-3 rounded-lg bg-brand-50/50 p-3">
          <p className="text-xs font-semibold text-gray-700">Course list box</p>
          <p className="text-[11px] text-gray-500">
            The selected course&apos;s units render here at generation time. Drag
            to position, then set the font size and wrap width below.
          </p>
          <p className="rounded bg-white/70 px-2 py-1.5 text-[11px] text-gray-600">
            <span className="font-semibold">Title:</span> the{" "}
            <span className="font-semibold">Label</span> field above is printed
            as a bold title over the list (e.g. &ldquo;Units Covered&rdquo;).
            Clear it to show no title.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600">
              Font size — {p.fontSize} pt
            </label>
            <input
              type="range"
              min={9}
              max={48}
              step={1}
              value={p.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Font size (pt)</label>
              <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Align</label>
              <select className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.align} onChange={(e) => set({ align: e.target.value as TextAlign })}>
                {ALIGNS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600">
                Wrap width (pt)
              </label>
              <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.width ?? 0}
                placeholder="0 = no wrap"
                onChange={(e) => set({ width: Number(e.target.value) || undefined })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Color</label>
              <input type="color" className="mt-1 h-9 w-full rounded border-gray-300"
                value={p.color} onChange={(e) => set({ color: e.target.value })} />
            </div>
          </div>
        </div>
      )}

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

      {isBox && (
        <>
          {/* Quick-resize slider (keeps QR square; for image/signature it sets
              both width & height for a fast shrink, then fine-tune below). */}
          <div>
            <label className="block text-xs font-semibold text-gray-600">
              Size — {p.width ?? 64} pt
            </label>
            <input
              type="range"
              min={24}
              max={256}
              step={2}
              value={p.width ?? 64}
              onChange={(e) =>
                p.kind === "qr"
                  ? resizeSquare(Number(e.target.value))
                  : set({ width: Number(e.target.value) })
              }
              className="mt-1 w-full"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Drag to shrink or enlarge. QR stays square; fine-tune width/height below.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Width (pt)</label>
              <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.width ?? 64}
                onChange={(e) =>
                  p.kind === "qr"
                    ? resizeSquare(Number(e.target.value))
                    : set({ width: Number(e.target.value) })
                } />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Height (pt)</label>
              <input type="number" className="mt-1 w-full rounded border-gray-300 text-sm"
                value={p.height ?? 64}
                onChange={(e) =>
                  p.kind === "qr"
                    ? resizeSquare(Number(e.target.value))
                    : set({ height: Number(e.target.value) })
                } />
            </div>
          </div>
        </>
      )}

      {p.kind === "qr" && (
        <div className="space-y-3 rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-600">QR appearance</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Module color</label>
              <input type="color" className="mt-1 h-9 w-full rounded border-gray-300"
                value={p.qrDark ?? "#000000"}
                onChange={(e) => set({ qrDark: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Background</label>
              <input type="color" className="mt-1 h-9 w-full rounded border-gray-300 disabled:opacity-40"
                value={p.qrLight ?? "#ffffff"}
                disabled={p.qrTransparent ?? false}
                onChange={(e) => set({ qrLight: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={p.qrTransparent ?? false}
              onChange={(e) => set({ qrTransparent: e.target.checked })}
            />
            Transparent background (recommended on dark certificates)
          </label>
          <p className="text-[11px] text-gray-400">
            On a dark background, set the module color to white and tick
            transparent so only the QR pattern shows.
          </p>
        </div>
      )}

      {p.kind === "signature" && (
        <p className="rounded-lg bg-gray-50 p-3 text-[11px] text-gray-500">
          If the assigned trainer has an uploaded signature image, it renders
          here. Otherwise the trainer&apos;s typed name is drawn as a signature.
        </p>
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
