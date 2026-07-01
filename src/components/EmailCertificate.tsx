"use client";

// Reusable "send certificate by email" control. Used on the Generate result
// panel and the History table. Posts to /api/certificates/[id]/email. If the
// linked trainee has an email, the optional override field can be left blank.

import { useState } from "react";

export function EmailCertificate({
  certificateId,
  compact = false,
}: {
  certificateId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/certificates/${certificateId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(to.trim() ? { to: to.trim() } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      setMessage(`Sent to ${json.to}`);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (compact && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 hover:underline"
      >
        Email
      </button>
    );
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Send by email
        </button>
        {message && <p className="mt-2 text-xs text-green-700">{message}</p>}
      </div>
    );
  }

  return (
    <div className={compact ? "" : "mt-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Recipient email (blank = linked trainee)"
          type="email"
          className="w-64 rounded-lg border-gray-300 text-sm"
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {message && <p className="mt-2 text-xs text-green-700">{message}</p>}
    </div>
  );
}
