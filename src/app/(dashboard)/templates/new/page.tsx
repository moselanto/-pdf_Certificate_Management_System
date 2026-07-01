"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PAGE_SIZES, type PageSizeKey } from "@/lib/domain/types";

type Mode = "upload" | "scratch";

const PAGE_SIZE_LABELS: Record<PageSizeKey, string> = {
  a4_landscape: "A4 Landscape (842 × 595 pt)",
  a4_portrait: "A4 Portrait (595 × 842 pt)",
  letter_landscape: "US Letter Landscape (792 × 612 pt)",
  letter_portrait: "US Letter Portrait (612 × 792 pt)",
};

export default function NewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pre-fill the name when arriving from the AI helper's "Use this" button.
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [mode, setMode] = useState<Mode>("upload");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<PageSizeKey>("a4_landscape");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please name the template.");
    if (mode === "upload" && !front) return setError("Please choose a front PDF.");

    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());

      if (mode === "scratch") {
        const size = PAGE_SIZES[pageSize];
        form.set("fromScratch", "true");
        form.set("pageWidth", String(size.width));
        form.set("pageHeight", String(size.height));
      } else {
        form.set("front", front!);
        if (back) form.set("back", back);
      }

      const res = await fetch("/api/templates", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      router.push(`/templates/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const modeTab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={[
        "flex-1 rounded-lg px-4 py-2 text-sm font-semibold",
        mode === m
          ? "bg-brand-600 text-white"
          : "border border-gray-300 text-gray-600 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">New template</h2>
        <p className="text-sm text-gray-500">
          Upload a PDF certificate design, or build one from scratch on a blank
          canvas — then add your dynamic fields (name, date, QR).
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        {modeTab("upload", "Upload PDF")}
        {modeTab("scratch", "Start from scratch")}
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Template name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Standard Completion Certificate"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {mode === "upload" ? (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Front PDF <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFront(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Back PDF <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setBack(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                The back page supports dynamic course content when generating. If you
                leave this blank but select a course at generation time, CertForge
                adds a clean &ldquo;Course Units&rdquo; back page automatically.
              </p>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Page size
            </label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSizeKey)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((key) => (
                <option key={key} value={key}>
                  {PAGE_SIZE_LABELS[key]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              You&apos;ll get a blank canvas. Use the{" "}
              <span className="font-medium">Draw / from scratch</span> mode in the
              designer to add text, lines, and boxes, then place dynamic fields on
              top.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy
              ? mode === "scratch"
                ? "Creating…"
                : "Uploading…"
              : mode === "scratch"
                ? "Create & design"
                : "Upload & design"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/templates")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
