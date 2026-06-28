"use client";

// Read-only activity feed backed by GET /api/audit. Filter by action group,
// load more via the keyset `before` cursor. Renders a human-friendly summary
// per entry from the action + metadata captured at write time.

import { useCallback, useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string;
}

// Top-level action groups for the filter (prefix match against `action`).
const FILTERS: { id: string; label: string; prefix: string }[] = [
  { id: "all", label: "All activity", prefix: "" },
  { id: "certificate", label: "Certificates", prefix: "certificate." },
  { id: "template", label: "Templates", prefix: "template." },
  { id: "course", label: "Courses", prefix: "course." },
  { id: "trainer", label: "Trainers", prefix: "trainer." },
  { id: "trainee", label: "Trainees", prefix: "trainee." },
  { id: "org", label: "Settings", prefix: "org." },
];

function describe(e: AuditEntry): string {
  const m = e.metadata || {};
  const name = (m.name as string) || (m.certificate_number as string) || "";
  switch (e.action) {
    case "certificate.generate":
      return `Issued certificate ${m.certificate_number ?? ""}`.trim();
    case "certificate.email":
      return `Emailed certificate ${m.certificate_number ?? ""}`.trim();
    case "certificate.revoke":
      return `Revoked certificate ${m.certificate_number ?? ""}`.trim();
    case "certificate.unrevoke":
      return `Restored certificate ${m.certificate_number ?? ""}`.trim();
    case "certificate.delete":
      return `Deleted certificate ${m.certificate_number ?? ""}`.trim();
    case "certificate.bulk_generate":
      return `Bulk-issued ${m.count ?? "several"} certificates`;
    case "template.create":
      return `Created template${name ? ` “${name}”` : ""}${m.source === "ai" ? " (AI)" : ""}`;
    case "template.logo.upload":
      return `Updated logo on template${name ? ` “${name}”` : ""}`;
    case "template.logo.delete":
      return `Removed logo from template${name ? ` “${name}”` : ""}`;
    case "org.update":
      return `Updated organisation name${name ? ` to “${name}”` : ""}`;
    case "org.logo.upload":
      return "Updated organisation default logo";
    case "org.logo.delete":
      return "Removed organisation default logo";
    default:
      // Fallback: humanise the action verb + entity.
      return `${e.action.replace(/[._]/g, " ")}${name ? ` — ${name}` : ""}`;
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AuditLogTable() {
  const [filter, setFilter] = useState("all");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const prefix = FILTERS.find((f) => f.id === filter)?.prefix ?? "";
        const params = new URLSearchParams({ limit: "50" });
        if (prefix) params.set("action", prefix);
        if (!reset && nextBefore) params.set("before", nextBefore);
        const res = await fetch(`/api/audit?${params}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Failed to load activity");
        setEntries((prev) => (reset ? json.entries : [...prev, ...json.entries]));
        setNextBefore(json.nextBefore ?? null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filter, nextBefore],
  );

  // Reload from scratch whenever the filter changes.
  useEffect(() => {
    setEntries([]);
    setNextBefore(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.id
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {entries.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            No activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{describe(e)}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {e.actorName} · {e.entity}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-gray-400"
                  dateTime={e.createdAt}
                  title={new Date(e.createdAt).toLocaleString("en-GB")}
                >
                  {timeAgo(e.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-center">
        {nextBefore ? (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          loading && <p className="text-sm text-gray-400">Loading…</p>
        )}
      </div>
    </div>
  );
}
