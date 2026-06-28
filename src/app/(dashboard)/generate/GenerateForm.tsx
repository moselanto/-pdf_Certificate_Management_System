"use client";

// The one-minute certificate flow: choose template + course + trainer, type
// the recipient + issue date, click Generate. On success we show the
// certificate number, a verification link, a download button, and a small
// inline "email this certificate" widget.

import { useState } from "react";

interface Option { id: string; name: string }
interface CourseOption { id: string; title: string }

interface Result {
  id: string;
  certificateNumber: string;
}

export function GenerateForm({
  templates,
  courses,
  trainers,
}: {
  templates: Option[];
  courses: CourseOption[];
  trainers: Option[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!templateId) return setError("Choose a template.");
    if (!recipientName.trim()) return setError("Enter the recipient's name.");

    setBusy(true);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          courseId: courseId || undefined,
          trainerId: trainerId || undefined,
          recipientName: recipientName.trim(),
          issueDate,
          values: {},
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setResult({ id: json.id, certificateNumber: json.certificateNumber });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        You need at least one template first.{" "}
        <a href="/templates/new" className="font-medium text-brand-700 underline">
          Upload a template
        </a>
        .
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <Field label="Template" required>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          >
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Recipient name" required>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Jane W. Mwangi"
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Course (fills the back page)">
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 w-full rounded-lg border-gray-300 text-sm"
            >
              <option value="">None</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>

          <Field label="Trainer">
            <select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="mt-1 w-full rounded-lg border-gray-300 text-sm"
            >
              <option value="">None</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Issue date">
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </Field>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate certificate"}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h3 className="font-semibold text-green-800">Certificate generated</h3>
          <p className="mt-1 text-sm text-green-700">
            Number:{" "}
            <span className="font-mono font-semibold">{result.certificateNumber}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`/api/certificates/${result.id}/download`}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Download PDF
            </a>
            <a
              href={`/verify/${result.certificateNumber}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Open verification page
            </a>
          </div>
          <EmailCertificate certificateId={result.id} />
        </div>
      )}
    </div>
  );
}

// Inline "email this certificate" widget. Calls POST /api/certificates/[id]/email.
// Leave the address blank to send to the linked trainee's email; or type an
// address to override. Optional — generation already succeeded by this point.
function EmailCertificate({ certificateId }: { certificateId: string }) {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setErr(null);
    setSent(null);
    try {
      const res = await fetch(`/api/certificates/${certificateId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(to.trim() ? { to: to.trim() } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Email failed");
      setSent(json.to ?? to.trim() ?? "recipient");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-5 border-t border-green-200 pt-4">
      <p className="text-sm font-semibold text-green-800">Email this certificate</p>
      <p className="mt-0.5 text-xs text-green-700">
        Leave blank to send to the linked trainee, or enter an address to override.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          type="email"
          placeholder="name@example.com (optional)"
          className="min-w-[16rem] flex-1 rounded-lg border-gray-300 text-sm"
        />
        <button
          onClick={send}
          disabled={sending}
          className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send email"}
        </button>
      </div>
      {sent && (
        <p className="mt-2 text-xs font-medium text-green-700">Sent to {sent}.</p>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
