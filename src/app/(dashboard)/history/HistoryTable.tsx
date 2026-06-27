"use client";

import { useCallback, useEffect, useState } from "react";
import { EmailCertificate } from "@/components/EmailCertificate";

interface Certificate {
  id: string;
  certificate_number: string;
  recipient_name: string;
  issue_date: string;
  status: string;
  created_at: string;
}

export function HistoryTable() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = query ? `/api/certificates?q=${encodeURIComponent(query)}` : "/api/certificates";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.certificates ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    load("");
  }, [load]);

  // Debounced search as the user types.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      generated: "bg-blue-50 text-blue-700",
      emailed: "bg-green-50 text-green-700",
      revoked: "bg-red-50 text-red-700",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search recipient or certificate number…"
        className="w-full max-w-md rounded-lg border-gray-300 text-sm"
      />

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Certificate No.</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Issue date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No certificates found.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.certificate_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.recipient_name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(c.issue_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`/api/certificates/${c.id}/download`}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Download
                      </a>
                      <EmailCertificate certificateId={c.id} compact />
                      <a
                        href={`/verify/${c.certificate_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-gray-600 hover:underline"
                      >
                        Verify
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
