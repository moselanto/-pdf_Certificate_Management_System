"use client";

// Settings form: edit the organisation name (used as the default "Issued by"
// on verification pages), manage the organisation DEFAULT LOGO (used as the
// fallback for any template with a placed Logo field but no template-specific
// logo), plus read-only account info. Saves via PATCH/POST/DELETE /api/settings.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SettingsForm({
  initialOrgName,
  initialLogoUrl,
  email,
  role,
}: {
  initialOrgName: string;
  initialLogoUrl: string | null;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(initialOrgName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Org default logo state.
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = role === "owner" || role === "admin";

  const uploadLogo = async (file: File) => {
    setLogoError(null);
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/settings", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Logo upload failed");
      setLogoUrl(json.logoUrl ?? null);
      router.refresh();
    } catch (err) {
      setLogoError((err as Error).message);
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    setLogoError(null);
    setLogoBusy(true);
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Remove failed");
      setLogoUrl(null);
      router.refresh();
    } catch (err) {
      setLogoError((err as Error).message);
    } finally {
      setLogoBusy(false);
    }
  };

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

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">Default logo</h3>
        <p className="text-xs text-gray-500">
          Used on any template that has a Logo field but no logo of its own. Set
          it once here to brand every certificate. A template can still override
          with its own logo. PNG or JPEG, under 2&nbsp;MB.
        </p>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Organisation logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400">No logo</span>
            )}
          </div>

          {canEdit && (
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                disabled={logoBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
                className="text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-700"
              />
              {logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  disabled={logoBusy}
                  className="self-start text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove logo
                </button>
              )}
            </div>
          )}
        </div>

        {logoBusy && <p className="text-xs text-gray-500">Working…</p>}
        {logoError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{logoError}</div>
        )}
        {!canEdit && (
          <p className="text-xs text-gray-400">Only an owner or admin can change the default logo.</p>
        )}
      </div>

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
