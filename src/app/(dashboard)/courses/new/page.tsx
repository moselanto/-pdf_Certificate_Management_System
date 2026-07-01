"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Please give the course a title.");
    setBusy(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      router.push(`/courses/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">New course</h2>
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700">Course title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Data Operations Fundamentals"
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create & add units"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/courses")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
