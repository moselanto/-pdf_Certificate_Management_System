"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function NewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pre-fill the name when arriving from the AI helper's "Use this" button.
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please name the template.");
    if (!front) return setError("Please choose a front PDF.");

    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("front", front);
      if (back) form.set("back", back);

      const res = await fetch("/api/templates", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      router.push(`/templates/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">New template</h2>
        <p className="text-sm text-gray-500">
          Upload your certificate design as PDF. We keep the original quality and
          overlay your fields on top.
        </p>
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
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </div>

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
            {busy ? "Uploading…" : "Upload & design"}
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
