"use client";

// Searchable trainee directory with inline create, edit, and delete. Uses
// GET /api/trainees?q= (debounced), POST /api/trainees, and
// PATCH/DELETE /api/trainees/[id].

import { useCallback, useEffect, useState } from "react";

interface Trainee {
  id: string;
  name: string;
  email: string | null;
}

export function TraineesDirectory() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // inline-create form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // inline-edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = query
        ? `/api/trainees?q=${encodeURIComponent(query)}`
        : "/api/trainees";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.trainees ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    setCreating(true);
    try {
      const res = await fetch("/api/trainees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setName("");
      setEmail("");
      setRows((r) => [json.trainee, ...r]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t: Trainee) => {
    setError(null);
    setEditingId(t.id);
    setEditName(t.name);
    setEditEmail(t.email ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
  };

  const saveEdit = async (id: string) => {
    setError(null);
    if (!editName.trim()) return setError("Name can't be empty.");
    setSavingId(id);
    try {
      const res = await fetch(`/api/trainees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setRows((r) => r.map((t) => (t.id === id ? json.trainee : t)));
      cancelEdit();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (t: Trainee) => {
    if (!confirm(`Delete trainee "${t.name}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/trainees/${t.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setRows((r) => r.filter((row) => row.id !== t.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Inline create */}
      <form onSubmit={create} className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="flex-1 rounded-lg border-gray-300 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            type="email"
            className="flex-1 rounded-lg border-gray-300 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? "Adding…" : "+ Add trainee"}
          </button>
        </div>
      </form>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search trainees…"
        className="w-full max-w-md rounded-lg border-gray-300 text-sm"
      />

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  No trainees yet.
                </td>
              </tr>
            ) : (
              rows.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id} className="bg-brand-50/40">
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border-gray-300 text-sm"
                        placeholder="Full name"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        type="email"
                        className="w-full rounded-lg border-gray-300 text-sm"
                        placeholder="Email (optional)"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(t.id)}
                          disabled={savingId === t.id}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          {savingId === t.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(t)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(t)}
                          disabled={deletingId === t.id}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === t.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
