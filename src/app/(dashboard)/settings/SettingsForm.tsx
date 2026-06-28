"use client";

// Settings form: edit the organisation name (used as the default "Issued by"
// on verification pages), plus read-only account info. Saves via
// PATCH /api/settings.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SettingsForm({
  initialOrgName,
  email,
  role,
}: {
  initialOrgName: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(initialOrgName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!orgName.trim()) return setError("Organisation name can't be empty.");
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim() }),
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
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">Organisation</h3>

        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Organisation name
          </label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Pimofy Training Institute"
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Shown as the default &ldquo;Issued by&rdquo; on certificate
            verification pages when the assigned trainer has no institution set.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {saved && !error && <p className="text-xs font-medium text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">Account</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Signed in as</dt>
            <dd className="font-medium text-gray-900">{email || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium text-gray-900">{role || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
