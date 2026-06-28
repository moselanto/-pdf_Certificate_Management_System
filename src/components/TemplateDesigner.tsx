"use client";

// ============================================================================
// TemplateDesigner — orchestrates the full template editing experience:
//   • Toolbar to add fields (text/date/qr/signature)
//   • PlaceholderEditor (drag-and-drop on the page raster)
//   • FieldInspector (edit selected field)
//   • Live preview -> POSTs current layout + a sample name you can edit, then
//     shows the rendered PDF in an <iframe>.
//
// NOTE: Live preview uses a SAMPLE name purely so you can check placement here
// in the designer. The real recipient name comes from the Generate Certificate
// screen. The sample name field below lets you type any name to preview with,
// so the preview reflects what you type rather than a fixed placeholder.
// ============================================================================

import { useMemo, useState } from "react";
import type { Placeholder, PlaceholderKind } from "@/lib/domain/types";
import { PlaceholderEditor } from "./PlaceholderEditor";
import { FieldInspector } from "./FieldInspector";

let idCounter = 0;
const newId = () => `ph_${Date.now()}_${idCounter++}`;

interface Props {
  templateId: string;
  pageImageUrl: string;
  pageWidth: number;
  pageHeight: number;
  initialPlaceholders?: Placeholder[];
  onSave: (placeholders: Placeholder[]) => Promise<void>;
}

const FIELD_PRESETS: Array<{ kind: PlaceholderKind; label: string; fieldKey: string }> = [
  { kind: "text", label: "Recipient Name", fieldKey: "recipient_name" },
  { kind: "text", label: "Certificate Title", fieldKey: "certificate_title" },
  { kind: "date", label: "Issue Date", fieldKey: "issue_date" },
  { kind: "text", label: "Trainer Name", fieldKey: "trainer_name" },
  { kind: "text", label: "Certificate No.", fieldKey: "certificate_number" },
  { kind: "signature", label: "Trainer Signature", fieldKey: "trainer_signature" },
  { kind: "qr", label: "Verification QR", fieldKey: "qr_code" },
];

export function TemplateDesigner({
  templateId,
  pageImageUrl,
  pageWidth,
  pageHeight,
  initialPlaceholders = [],
  onSave,
}: Props) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(initialPlaceholders);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Jane W. Mwangi");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const selected = useMemo(
    () => placeholders.find((p) => p.id === selectedId),
    [placeholders, selectedId],
  );

  const addField = (preset: (typeof FIELD_PRESETS)[number]) => {
    const isImage = preset.kind === "qr" || preset.kind === "signature";
    const ph: Placeholder = {
      id: newId(),
      page: "front",
      kind: preset.kind,
      fieldKey: preset.fieldKey,
      label: preset.label,
      x: Math.round(pageWidth / 2),
      y: Math.round(pageHeight / 2),
      // Smaller, sensible defaults: QR 64pt, signature 120x48pt.
      width: preset.kind === "qr" ? 64 : preset.kind === "signature" ? 120 : undefined,
      height: preset.kind === "qr" ? 64 : preset.kind === "signature" ? 48 : undefined,
      fontSize: 18,
      fontFamily: "Helvetica",
      color: "#111111",
      align: "center",
    };
    setPlaceholders((prev) => [...prev, ph]);
    setSelectedId(ph.id);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(placeholders);
    } finally {
      setSaving(false);
    }
  };

  const livePreview = async () => {
    setPreviewing(true);
    try {
      // Build sample values so the admin sees a realistic certificate.
      // The recipient name uses whatever you typed in the preview-name box.
      const sample: Record<string, string> = {};
      placeholders.forEach((p) => {
        if (p.fieldKey === "recipient_name") sample[p.fieldKey] = previewName || "Sample Name";
        else if (p.fieldKey === "issue_date") sample[p.fieldKey] = new Date().toLocaleDateString();
        else if (p.fieldKey === "certificate_number") sample[p.fieldKey] = "CF-2026-7QK3M9";
        else if (p.fieldKey === "trainer_name") sample[p.fieldKey] = "Lydia Kasera-Kwoba";
        else if (p.kind === "text") sample[p.fieldKey] = p.label;
      });

      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, placeholders, values: sample }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      alert(`Preview failed: ${(e as Error).message}`);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          {FIELD_PRESETS.map((preset) => (
            <button
              key={preset.fieldKey}
              onClick={() => addField(preset)}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              + {preset.label}
            </button>
          ))}
        </div>

        <PlaceholderEditor
          pageImageUrl={pageImageUrl}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          placeholders={placeholders}
          onChange={setPlaceholders}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <div className="flex flex-wrap items-end gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save layout"}
          </button>

          <div>
            <label className="block text-xs font-medium text-gray-500">
              Preview name (sample only)
            </label>
            <input
              value={previewName}
              onChange={(e) => setPreviewName(e.target.value)}
              placeholder="Type a name to preview"
              className="mt-1 w-56 rounded-lg border-gray-300 text-sm"
            />
          </div>

          <button
            onClick={livePreview}
            disabled={previewing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {previewing ? "Rendering…" : "Live preview"}
          </button>
        </div>

        <p className="text-xs text-gray-500">
          The preview uses a sample name so you can check placement. The real
          recipient name is entered on the Generate Certificate screen.
        </p>

        {previewUrl && (
          <iframe
            title="Live certificate preview"
            src={previewUrl}
            className="h-[520px] w-full rounded-lg border border-gray-300"
          />
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Field properties</h3>
        <FieldInspector
          placeholder={selected}
          onChange={(next) =>
            setPlaceholders((prev) => prev.map((p) => (p.id === next.id ? next : p)))
          }
          onDelete={(id) => {
            setPlaceholders((prev) => prev.filter((p) => p.id !== id));
            setSelectedId(undefined);
          }}
        />
      </div>
    </div>
  );
}
