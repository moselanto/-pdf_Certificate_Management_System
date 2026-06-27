"use client";

// Three-step wizard:
//   1. Upload spreadsheet -> POST /api/bulk/parse -> headers + preview
//   2. Map columns to certificate fields + pick template/course/trainer
//   3. Generate -> POST /api/bulk/generate -> stream ZIP, show batch stats
//
// recipient_name is the only required mapping. Everything else is optional and
// flows into the certificate field values for the template placeholders.

import { useMemo, useState } from "react";

interface Option { id: string; name: string }
interface CourseOption { id: string; title: string }

interface ParseResponse {
  headers: string[];
  rowCount: number;
  preview: Record<string, string>[];
  fields: { key: string; label: string; required: boolean }[];
  suggestedMapping: Record<string, string>;
}

interface BatchStats { total: number; succeeded: number; failed: number }

export function BulkImportWizard({
  templates,
  courses,
  trainers,
}: {
  templates: Option[];
  courses: CourseOption[];
  trainers: Option[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [templateId, setTemplateId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const step = useMemo(() => {
    if (stats) return 3;
    if (parsed) return 2;
    return 1;
  }, [parsed, stats]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose a spreadsheet file.");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/bulk/parse", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      setParsed(json);
      setMapping(json.suggestedMapping ?? {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setError(null);
    if (!templateId) return setError("Choose a template.");
    if (!mapping.recipient_name) return setError("Map a column to the recipient name.");
    if (!file) return setError("File missing — please re-upload.");

    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set(
        "config",
        JSON.stringify({
          templateId,
          courseId: courseId || undefined,
          trainerId: trainerId || undefined,
          mapping,
          issueDate,
        }),
      );
      const res = await fetch("/api/bulk/generate", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Generation failed");
      }
      setStats({
        total: Number(res.headers.get("X-Batch-Total") ?? 0),
        succeeded: Number(res.headers.get("X-Batch-Succeeded") ?? 0),
        failed: Number(res.headers.get("X-Batch-Failed") ?? 0),
      });
      const blob = await res.blob();
      setZipUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsed(null);
    setMapping({});
    setStats(null);
    setZipUrl(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <Steps current={step} />

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* STEP 1 — upload */}
      {step === 1 && (
        <form onSubmit={upload} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Spreadsheet (.xlsx, .xls, or .csv)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              First row should be column headers. One recipient per row.
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Reading…" : "Upload & preview"}
          </button>
        </form>
      )}

      {/* STEP 2 — map + configure */}
      {step === 2 && parsed && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-700">
              Map columns ({parsed.rowCount} rows detected)
            </h3>
            <div className="mt-4 space-y-3">
              {parsed.fields.map((f) => (
                <div key={f.key} className="grid grid-cols-2 items-center gap-4">
                  <span className="text-sm text-gray-700">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                    }
                    className="rounded-lg border-gray-300 text-sm"
                  >
                    <option value="">— not mapped —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Certificate settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-700">Template *</span>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm">
                  <option value="">Select…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-gray-700">Issue date (default)</span>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-700">Course (back page)</span>
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm">
                  <option value="">None</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-gray-700">Trainer</span>
                <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm">
                  <option value="">None</option>
                  {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-left font-semibold text-gray-500">
                <tr>{parsed.headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsed.preview.map((row, i) => (
                  <tr key={i}>
                    {parsed.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-700">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={generate} disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? `Generating ${parsed.rowCount} certificates…` : `Generate ${parsed.rowCount} certificates`}
            </button>
            <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Start over
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — results */}
      {step === 3 && stats && (
        <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6">
          <h3 className="font-semibold text-green-800">Batch complete</h3>
          <div className="flex gap-6 text-sm">
            <Stat label="Total" value={stats.total} />
            <Stat label="Succeeded" value={stats.succeeded} tone="text-green-700" />
            <Stat label="Failed" value={stats.failed} tone={stats.failed ? "text-red-700" : "text-gray-500"} />
          </div>
          <p className="text-xs text-green-700">
            The ZIP includes every generated PDF plus a results.csv manifest
            showing the status of each row.
          </p>
          <div className="flex gap-3">
            {zipUrl && (
              <a href={zipUrl} download={`certificates-${Date.now()}.zip`}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Download ZIP
              </a>
            )}
            <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const labels = ["Upload", "Map & configure", "Results"];
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={l} className="flex items-center gap-2">
            <span className={[
              "flex h-6 w-6 items-center justify-center rounded-full",
              active ? "bg-brand-600 text-white" : done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600",
            ].join(" ")}>{done ? "✓" : n}</span>
            <span className={active ? "text-gray-900" : "text-gray-400"}>{l}</span>
            {n < labels.length && <span className="mx-1 text-gray-300">→</span>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone = "text-gray-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
