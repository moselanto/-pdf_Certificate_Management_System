"use client";

// ============================================================================
// TemplateDesigner — orchestrates the full template editing experience:
//   • Front / Back page toggle (shows the matching PDF backdrop)
//   • Toolbar to add fields (text/date/qr/signature/course-list)
//   • PlaceholderEditor (drag-and-drop on the active page raster)
//   • FieldInspector (edit selected field)
//   • Live preview -> POSTs current layout + a sample name you can edit, then
//     shows the rendered PDF in an <iframe>.
//
// The editor shows ONE page at a time. New fields are added to the active page,
// and only that page's placeholders are shown/dragged — but Save always
// persists BOTH pages' placeholders together.
// ============================================================================

import { useMemo, useState } from "react";
import type { Placeholder, PlaceholderKind, PlaceholderPage } from "@/lib/domain/types";
import { PlaceholderEditor } from "./PlaceholderEditor";
import { FieldInspector } from "./FieldInspector";

let idCounter = 0;
const newId = () => `ph_${Date.now()}_${idCounter++}`;

interface Props {
  templateId: string;
  pageImageUrl: string;
  backImageUrl?: string;
  hasBackPdf?: boolean;
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
  { kind: "course_list", label: "Course List", fieldKey: "course_units" },
];

export function TemplateDesigner({
  templateId,
  pageImageUrl,
  backImageUrl,
  hasBackPdf = false,
  pageWidth,
  pageHeight,
  initialPlaceholders = [],
  onSave,
}: Props) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(initialPlaceholders);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [activePage, setActivePage] = useState<PlaceholderPage>("front");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Jane W. Mwangi");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const selected = useMemo(
    () => placeholders.find((p) => p.id === selectedId),
    [placeholders, selectedId],
  );

  // Only show the active page's fields on the canvas.
  const visiblePlaceholders = useMemo(
    () => placeholders.filter((p) => (p.page ?? "front") === activePage),
    [placeholders, activePage],
  );

  // The backdrop for the active page. If there's no back image (no back PDF, or
  // it failed to rasterize) we show a blank canvas so back fields can still be
  // positioned by eye.
  const backdrop =
    activePage === "back"
      ? backImageUrl ?? BLANK_PAGE
      : pageImageUrl;

  const addField = (preset: (typeof FIELD_PRESETS)[number]) => {
    const isCourseList = preset.kind === "course_list";
    const ph: Placeholder = {
      id: newId(),
      // New fields land on whichever page you're currently editing. The course
      // list defaults to the back page (it's a back-page element).
      page: isCourseList ? "back" : activePage,
      kind: preset.kind,
      fieldKey: preset.fieldKey,
      // For the course list, the label doubles as the printed TITLE shown above
      // the units, so default it to "Units Covered" rather than "Course List".
      label: isCourseList ? "Units Covered" : preset.label,
      x: Math.round(pageWidth / 2),
      y: Math.round(pageHeight / 2),
      width: preset.kind === "qr" ? 64 : preset.kind === "signature" ? 120 : undefined,
      height: preset.kind === "qr" ? 64 : preset.kind === "signature" ? 48 : undefined,
      fontSize: isCourseList ? 16 : 18,
      fontFamily: "Helvetica",
      color: "#111111",
      align: isCourseList ? "left" : "center",
    };
    // Jump to the page the new field lives on so you see it immediately.
    if ((ph.page ?? "front") !== activePage) setActivePage(ph.page);
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

  const tabClass = (page: PlaceholderPage) =>
    [
      "rounded-lg px-4 py-1.5 text-sm font-semibold",
      activePage === page
        ? "bg-brand-600 text-white"
        : "border border-gray-300 text-gray-600 hover:bg-gray-50",
    ].join(" ");

  const countOn = (page: PlaceholderPage) =>
    placeholders.filter((p) => (p.page ?? "front") === page).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* Front / Back page toggle */}
        <div className="flex items-center gap-2">
          <button onClick={() => setActivePage("front")} className={tabClass("front")}>
            Front ({countOn("front")})
          </button>
          <button onClick={() => setActivePage("back")} className={tabClass("back")}>
            Back ({countOn("back")})
          </button>
          {activePage === "back" && !backImageUrl && (
            <span className="ml-2 text-xs text-gray-400">
              {hasBackPdf
                ? "Rendering back page…"
                : "No back PDF uploaded — a clean back page is generated automatically."}
            </span>
          )}
        </div>

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
          key={activePage}
          pageImageUrl={backdrop}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          placeholders={visiblePlaceholders}
          onChange={(updatedVisible) => {
            // Merge edits to the visible (active-page) set back into the full
            // placeholder list, preserving the other page's fields untouched.
            setPlaceholders((prev) => {
              const others = prev.filter((p) => (p.page ?? "front") !== activePage);
              return [...others, ...updatedVisible];
            });
          }}
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
          Editing the <span className="font-semibold">{activePage}</span> page.
          Switch pages with the toggle above. The preview uses a sample name so
          you can check placement; the real recipient name is entered on the
          Generate Certificate screen.
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

// A 1x1 white pixel data URL used as a blank backdrop for the back page when no
// back PDF raster is available. The editor stretches it to the page aspect.
const BLANK_PAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="842" height="595"><rect width="100%" height="100%" fill="#ffffff" stroke="#e5e7eb"/></svg>',
  );
