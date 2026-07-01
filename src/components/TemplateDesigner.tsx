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

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DesignElement,
  Placeholder,
  PlaceholderKind,
  PlaceholderPage,
} from "@/lib/domain/types";
import { PlaceholderEditor } from "./PlaceholderEditor";
import { FieldInspector } from "./FieldInspector";
import { DesignElementLayer, type DrawTool } from "./DesignElementLayer";
import { DesignInspector } from "./DesignInspector";

let idCounter = 0;
const newId = () => `ph_${Date.now()}_${idCounter++}`;
let deCounter = 0;
const newDeId = () => `de_${Date.now()}_${deCounter++}`;

interface Props {
  templateId: string;
  pageImageUrl: string;
  backImageUrl?: string;
  hasBackPdf?: boolean;
  pageWidth: number;
  pageHeight: number;
  // The back page may be a different size than the front; when known, the back
  // canvas scales to these so back fields don't drift vertically.
  backPageWidth?: number;
  backPageHeight?: number;
  initialPlaceholders?: Placeholder[];
  // Static design elements (from-scratch drawing mode). Optional; defaults [].
  initialDesignElements?: DesignElement[];
  onSave: (placeholders: Placeholder[], designElements: DesignElement[]) => Promise<void>;
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
  // Logo is an image placeholder; its picture is the template's uploaded logo
  // (managed by the logo upload control), drawn into this box on every cert.
  { kind: "image", label: "Logo", fieldKey: "logo" },
];

export function TemplateDesigner({
  templateId,
  pageImageUrl,
  backImageUrl,
  hasBackPdf = false,
  pageWidth,
  pageHeight,
  backPageWidth,
  backPageHeight,
  initialPlaceholders = [],
  initialDesignElements = [],
  onSave,
}: Props) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(initialPlaceholders);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [activePage, setActivePage] = useState<PlaceholderPage>("front");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Jane W. Mwangi");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // Preview trainer: when a signature field is placed, you can pick a trainer
  // to preview with. If they have an uploaded signature, the preview shows
  // their REAL signature image; otherwise a sample signature image is shown.
  const [trainers, setTrainers] = useState<
    { id: string; name: string; signature_path: string | null }[]
  >([]);
  const [previewTrainerId, setPreviewTrainerId] = useState<string>("");

  // --- Drawing mode (from-scratch design elements) -------------------------
  // "fields" = the classic placeholder editor; "draw" = draw static artwork
  // (text/line/rect) on the same canvas. Both save together.
  const [mode, setMode] = useState<"fields" | "draw">("fields");
  const [designElements, setDesignElements] = useState<DesignElement[]>(
    initialDesignElements,
  );
  const [selectedDeId, setSelectedDeId] = useState<string | undefined>();
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  // Custom font family names for the font picker (standard fonts are added in
  // the inspector). Loaded from /api/fonts.
  const [customFonts, setCustomFonts] = useState<string[]>([]);

  // Load the org's custom fonts once (for the design text font picker).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/fonts")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const fams = (j.fonts ?? []).map((f: { family: string }) => f.family);
        setCustomFonts(fams);
      })
      .catch(() => !cancelled && setCustomFonts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Load trainers once (for the preview signature picker).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/trainers")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setTrainers(j.trainers ?? []);
      })
      .catch(() => !cancelled && setTrainers([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Logo upload state ---------------------------------------------------
  // The template carries ONE logo image; the "Logo" field (an image placeholder
  // with fieldKey "logo") positions it. We load/upload/remove it here.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load the current logo (if any) when the designer opens.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/templates/${templateId}/logo`)
      .then((r) => r.json())
      .then((j) => !cancelled && setLogoUrl(j.logoUrl ?? null))
      .catch(() => !cancelled && setLogoUrl(null));
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    setLogoError(null);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch(`/api/templates/${templateId}/logo`, {
        method: "POST",
        body: form,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Logo upload failed");
      setLogoUrl(j.logoUrl ?? null);
    } catch (e) {
      setLogoError((e as Error).message);
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    setLogoError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/logo`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not remove logo");
      }
      setLogoUrl(null);
    } catch (e) {
      setLogoError((e as Error).message);
    } finally {
      setLogoBusy(false);
    }
  };

  // True once the user has added a signature placeholder (e.g. Trainer
  // Signature) to either page — used to show the preview signature picker.
  const hasSignatureField = useMemo(
    () => placeholders.some((p) => p.kind === "signature" && p.fieldKey !== "logo"),
    [placeholders],
  );

  // True once the user has added a "logo" placeholder to either page.
  const hasLogoField = useMemo(
    () => placeholders.some((p) => p.kind === "image" && p.fieldKey === "logo"),
    [placeholders],
  );

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

  // Use the ACTIVE page's real dimensions. The back page can be a different
  // size than the front; scaling the back canvas to the front size is what made
  // back fields drift to the bottom. Fall back to front size when back size is
  // unknown (e.g. no back PDF — the auto back page matches the front size).
  const activeWidth =
    activePage === "back" ? backPageWidth ?? pageWidth : pageWidth;
  const activeHeight =
    activePage === "back" ? backPageHeight ?? pageHeight : pageHeight;

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
      x: Math.round(activeWidth / 2),
      y: Math.round(activeHeight / 2),
      width:
        preset.kind === "qr"
          ? 64
          : preset.kind === "signature"
            ? 120
            : preset.kind === "image"
              ? 120
              : undefined,
      height:
        preset.kind === "qr"
          ? 64
          : preset.kind === "signature"
            ? 48
            : preset.kind === "image"
              ? 120
              : undefined,
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
      await onSave(placeholders, designElements);
    } finally {
      setSaving(false);
    }
  };

  // --- Design-element helpers (drawing mode) -------------------------------
  // Only the active page's elements are shown/edited on the canvas; the other
  // page's elements are preserved on change/save.
  const visibleDesignElements = useMemo(
    () => designElements.filter((d) => (d.page ?? "front") === activePage),
    [designElements, activePage],
  );

  const mergeVisibleDesign = (updatedVisible: DesignElement[]) => {
    setDesignElements((prev) => {
      const others = prev.filter((d) => (d.page ?? "front") !== activePage);
      return [...others, ...updatedVisible];
    });
  };

  const createDesignElement = (el: DesignElement) => {
    // Stamp it onto the active page and give it a stable id.
    const stamped = { ...el, id: newDeId(), page: activePage } as DesignElement;
    setDesignElements((prev) => [...prev, stamped]);
    setSelectedDeId(stamped.id);
  };

  const selectedDesign = useMemo(
    () => designElements.find((d) => d.id === selectedDeId),
    [designElements, selectedDeId],
  );

  const updateDesignElement = (next: DesignElement) =>
    setDesignElements((prev) => prev.map((d) => (d.id === next.id ? next : d)));

  const deleteDesignElement = (id: string) => {
    setDesignElements((prev) => prev.filter((d) => d.id !== id));
    setSelectedDeId(undefined);
  };

  const duplicateDesignElement = (id: string) => {
    const src = designElements.find((d) => d.id === id);
    if (!src) return;
    const copy = { ...src, id: newDeId(), x: src.x + 12, y: src.y + 12 } as DesignElement;
    setDesignElements((prev) => [...prev, copy]);
    setSelectedDeId(copy.id);
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
        body: JSON.stringify({
          templateId,
          placeholders,
          values: sample,
          ...(previewTrainerId ? { trainerId: previewTrainerId } : {}),
        }),
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

  const modeClass = (m: "fields" | "draw") =>
    [
      "rounded-lg px-4 py-1.5 text-sm font-semibold",
      mode === m
        ? "bg-gray-900 text-white"
        : "border border-gray-300 text-gray-600 hover:bg-gray-50",
    ].join(" ");

  const drawToolClass = (t: DrawTool) =>
    [
      "rounded-full px-3 py-1 text-sm font-medium",
      drawTool === t
        ? "bg-brand-600 text-white"
        : "border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
    ].join(" ");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* Mode toggle: place dynamic fields vs. draw static artwork */}
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <button onClick={() => setMode("fields")} className={modeClass("fields")}>
            Place fields
          </button>
          <button onClick={() => setMode("draw")} className={modeClass("draw")}>
            Draw / from scratch
          </button>
          <span className="ml-1 text-xs text-gray-400">
            {mode === "fields"
              ? "Add dynamic fields (name, date, QR) that fill per recipient."
              : "Draw static text, lines, and boxes directly on the page."}
          </span>
        </div>

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

        {/* Toolbar — dynamic fields (fields mode) OR draw tools (draw mode) */}
        {mode === "fields" ? (
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
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-gray-400">Tools:</span>
            <button onClick={() => setDrawTool("select")} className={drawToolClass("select")}>
              Select / move
            </button>
            <button onClick={() => setDrawTool("text")} className={drawToolClass("text")}>
              + Text
            </button>
            <button onClick={() => setDrawTool("line")} className={drawToolClass("line")}>
              + Line
            </button>
            <button onClick={() => setDrawTool("rect")} className={drawToolClass("rect")}>
              + Rectangle
            </button>
            <span className="ml-1 text-xs text-gray-400">
              {drawTool === "select"
                ? "Click an element to select; drag to move."
                : drawTool === "text"
                  ? "Click on the page to drop text."
                  : `Press and drag on the page to draw a ${drawTool}.`}
            </span>
          </div>
        )}

        {/* Logo upload control */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Template logo" className="max-h-16 max-w-16 object-contain" />
              ) : (
                <span className="px-1 text-center text-[10px] text-gray-400">No logo</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Template logo</p>
              <p className="text-xs text-gray-500">
                Upload a logo (PNG or JPEG, under 2 MB), then add the{" "}
                <span className="font-medium">+ Logo</span> field and drag it where you
                want it. It prints on every certificate from this template.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoBusy}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {logoBusy ? "Working…" : logoUrl ? "Replace logo" : "Upload logo"}
              </button>
              {logoUrl && (
                <button
                  onClick={removeLogo}
                  disabled={logoBusy}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {logoError && <p className="mt-2 text-xs text-red-600">{logoError}</p>}
          {hasLogoField && !logoUrl && (
            <p className="mt-2 text-xs text-amber-600">
              You added a Logo field but haven&apos;t uploaded a logo yet — upload one
              above or the box will print empty.
            </p>
          )}
        </div>

        <PlaceholderEditor
          key={activePage}
          pageImageUrl={backdrop}
          pageWidth={activeWidth}
          pageHeight={activeHeight}
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
          // In draw mode, the design-element layer captures pointer events so
          // you can draw/select/move artwork. In fields mode it's display-only
          // (so drawn elements still show behind the field chips for context).
          overlayCaptures={mode === "draw"}
          renderOverlay={(scale) => (
            <DesignElementLayer
              scale={scale}
              pageWidth={activeWidth}
              pageHeight={activeHeight}
              elements={visibleDesignElements}
              tool={mode === "draw" ? drawTool : "select"}
              selectedId={mode === "draw" ? selectedDeId : undefined}
              onSelect={setSelectedDeId}
              onChange={mergeVisibleDesign}
              onCreate={createDesignElement}
              onToolConsumed={() => setDrawTool("select")}
            />
          )}
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
              className="mt-1 w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Preview trainer — only relevant when a signature field is placed.
              Pick a trainer to preview their real uploaded signature; leave on
              "Sample signature" to preview with a placeholder signature image. */}
          {hasSignatureField && (
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Preview signature
              </label>
              <select
                value={previewTrainerId}
                onChange={(e) => setPreviewTrainerId(e.target.value)}
                className="mt-1 w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Sample signature</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.signature_path ? "" : " (no signature on file)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={livePreview}
            disabled={previewing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {previewing ? "Rendering…" : "Live preview"}
          </button>
        </div>

        {hasSignatureField && (
          <p className="text-xs text-gray-500">
            Your Trainer Signature field prints the selected trainer&apos;s
            uploaded signature image. In this preview, pick a trainer to see
            their real signature, or leave it on &ldquo;Sample signature&rdquo;
            to check placement. Upload a trainer&apos;s signature on the Trainers
            screen.
          </p>
        )}

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
        {mode === "fields" ? (
          <>
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
          </>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Element properties</h3>
            <DesignInspector
              element={selectedDesign}
              customFonts={customFonts}
              onChange={updateDesignElement}
              onDelete={deleteDesignElement}
              onDuplicate={duplicateDesignElement}
            />
          </>
        )}
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
