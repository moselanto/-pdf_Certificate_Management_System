"use client";

// Upload / replace a trainer's signature PNG. Shows the current signature (if
// any) over a checkerboard so transparency is obvious, validates that the file
// is a PNG, and posts to /api/trainers/[id]/signature.

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignatureUpload({
  trainerId,
  currentSignatureUrl,
}: {
  trainerId: string;
  currentSignatureUrl: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentSignatureUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const onPick = (f: File | null) => {
    setError(null);
    setFile(f);
    if (f) {
      if (f.type !== "image/png") {
        setError("Please choose a PNG file (transparent background recommended).");
        return;
      }
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const upload = async () => {
    if (!file) return setError("Choose a PNG signature first.");
    if (file.type !== "image/png") return setError("Signature must be a PNG.");
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("signature", file);
      const res = await fetch(`/api/trainers/${trainerId}/signature`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-700">Signature</h3>

      <div
        className="flex h-32 items-center justify-center rounded-lg border border-gray-200"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Signature" className="max-h-28 object-contain" />
        ) : (
          <span className="text-xs text-gray-400">No signature uploaded</span>
        )}
      </div>

      <input
        type="file"
        accept="image/png"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="w-full text-sm"
      />
      <p className="text-xs text-gray-500">
        Use a transparent PNG so the signature sits cleanly on the certificate.
        Position and size are set via a &quot;signature&quot; placeholder in the
        template designer.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={upload}
          disabled={busy || !file}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Save signature"}
        </button>
        {savedAt && <span className="text-xs text-green-600">Saved at {savedAt}</span>}
      </div>
    </div>
  );
}
