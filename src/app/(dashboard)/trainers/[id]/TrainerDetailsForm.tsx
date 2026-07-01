"use client";

// Editable trainer details (name, title, institution). Institution is shown as
// "Issued by" on the public verification page. Saves via PATCH /api/trainers/[id].

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrainerDetailsForm({
  trainerId,
  initialName,
  initialTitle,
  initialInstitution,
}: {
  trainerId: string;
  initialName: string;
  initialTitle: string;
  initialInstitution: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [institution, setInstitution] = useState(initialInstitution);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) return setError("Name can't be empty.");
    setSaving(true);
    try {
      const res = await fetch(`/api/trainers/${trainerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          institution: institution.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">Trainer details</h3>

      <div>
        <label className="block text-sm font-semibold text-gray-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border-gray-300 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700">
          Title <span className="text-gray-400">(optional)</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lead Trainer"
          className="mt-1 w-full rounded-lg border-gray-300 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700">
          Institution <span className="text-gray-400">(optional)</span>
        </label>
        <input
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="Pimofy Training Institute"
          className="mt-1 w-full rounded-lg border-gray-300 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Shown as &ldquo;Issued by&rdquo; on the certificate&apos;s verification page.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {saved && !error && (
        <p className="text-xs font-medium text-green-700">Saved.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
