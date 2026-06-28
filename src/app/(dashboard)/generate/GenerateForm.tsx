"use client";

// The one-minute certificate flow: choose template + course + trainer, pick or
// type the recipient + issue date, click Generate. On success we show the
// certificate number, a verification link, a download button, and a small
// inline "email this certificate" widget.

import { useMemo, useState } from "react";

interface Option { id: string; name: string }
interface CourseOption { id: string; title: string }
interface TraineeOption { id: string; name: string; email: string | null }

interface Result {
  id: string;
  certificateNumber: string;
}

const NEW_RECIPIENT = "__new__";

export function GenerateForm({
  templates,
  courses,
  trainers,
  trainees,
}: {
  templates: Option[];
  courses: CourseOption[];
  trainers: Option[];
  trainees: TraineeOption[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [trainerId, setTrainerId] = useState("");

  // Recipient: either pick a saved trainee, or choose "new" and type a name.
  const [traineeId, setTraineeId] = useState<string>(NEW_RECIPIENT);
  const [recipientName, setRecipientName] = useState("");

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const selectedTrainee = useMemo(
    () => trainees.find((t) => t.id === traineeId) ?? null,
    [trainees, traineeId],
  );

  // The name that will actually be printed: the picked trainee's name, or the
  // free-text field when adding a new recipient.
  const effectiveName =
    traineeId !== NEW_RECIPIENT ? selectedTrainee?.name ?? "" : recipientName.trim();

  const onPickRecipient = (value: string) => {
    setTraineeId(value);
    // When switching back to "new", keep whatever was typed.
    if (value !== NEW_RECIPIENT) setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!templateId) return setError("Choose a template.");
    if (!effectiveName) return setError("Choose a trainee or enter the recipient's name.");

    setBusy(true);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          courseId: courseId || undefined,
          trainerId: trainerId || undefined,
          traineeId: traineeId !== NEW_RECIPIENT ? traineeId : undefined,
          recipientName: effectiveName,
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

        {/* Recipient: saved trainee picker + free-text fallback */}
        <Field label="Recipient" required>
          <select
            value={traineeId}
            onChange={(e) => onPickRecipient(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          >
            <option value={NEW_RECIPIENT}>+ New recipient (type a name)</option>
            {trainees.length > 0 && (
              <optgroup label="Saved trainees">
                {trainees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.email ? ` · ${t.email}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {traineeId === NEW_RECIPIENT ? (
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Jane W. Mwangi"
              className="mt-2 w-full rounded-lg border-gray-300 text-sm"
            />
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              Printing for <span className="font-medium text-gray-700">{selectedTrainee?.name}</span>
              {selectedTrainee?.email
                ? ` — certificate can be emailed to ${selectedTrainee.email}.`
                : " — no email on file; add one in Trainees to enable emailing."}
            </p>
          )}
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
          <EmailCertificate
            certificateId={result.id}
            defaultEmail={selectedTrainee?.email ?? ""}
          />
        </div>
      )}
    </div>
  );
}

// Inline "email this certificate" widget. Calls POST /api/certificates/[id]/email.
// Pre-fills the linked trainee's email when one is known; leave blank to use the
// trainee on file, or type an address to override.
function EmailCertificate({
  certificateId,
  defaultEmail,
}: {
  certificateId: string;
  defaultEmail?: string;
}) {
  const [to, setTo] = useState(defaultEmail ?? "");
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
