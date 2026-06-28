"use client";

// AI template helper: a collapsible panel on the Templates page. The user can
// either type a free-text brief or answer a few guided questions, and we return
// 2-3 sample template ideas (name, description, palette, suggested fields, and
// an optional back-page note). Each idea has a "Use this" button that takes the
// user to the upload page pre-named, ready to upload their PDF design.

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Suggestion {
  name: string;
  description: string;
  palette: string[];
  fields: string[];
  backPage?: string;
}

export function AiTemplateHelper() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"brief" | "guided">("guided");

  const [brief, setBrief] = useState("");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Professional");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [includeBack, setIncludeBack] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const run = async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const body =
        mode === "brief"
          ? { brief: brief.trim() }
          : { purpose, audience, tone, orientation, includeBack };
      const res = await fetch("/api/templates/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate ideas");
      setSuggestions(json.suggestions ?? []);
      setSource(json.source ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const useSuggestion = (s: Suggestion) => {
    // Pre-fill the upload page's template name via query param.
    router.push(`/templates/new?name=${encodeURIComponent(s.name)}`);
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          Design with AI
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
            beta
          </span>
        </span>
        <span className="text-xs text-brand-700">{open ? "Hide" : "Get template ideas"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-brand-100 px-5 py-4">
          {/* Mode toggle */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setMode("guided")}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                mode === "guided"
                  ? "bg-brand-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Guided questions
            </button>
            <button
              onClick={() => setMode("brief")}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                mode === "brief"
                  ? "bg-brand-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Write a prompt
            </button>
          </div>

          {mode === "brief" ? (
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="e.g. A formal certificate of completion for a first-aid training course, navy and gold, with the course modules listed on the back."
              className="w-full rounded-lg border-gray-300 text-sm"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-700">
                What is it for?
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Course completion"
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-gray-700">
                Audience
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Healthcare trainees"
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-gray-700">
                Tone
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm font-normal"
                >
                  <option>Professional</option>
                  <option>Formal</option>
                  <option>Modern</option>
                  <option>Elegant</option>
                  <option>Friendly</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-700">
                Orientation
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as "landscape" | "portrait")}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm font-normal"
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={includeBack}
                  onChange={(e) => setIncludeBack(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Include a back page listing course units
              </label>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Thinking…" : "Suggest templates"}
            </button>
            {source === "builtin" && suggestions.length > 0 && (
              <span className="text-xs text-gray-400">
                Built-in suggestions (set OPENAI_API_KEY for AI-tailored ideas)
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s, i) => (
                <div key={i} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    {s.palette?.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="h-4 w-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-gray-900">{s.name}</h4>
                  <p className="mt-1 text-xs text-gray-600">{s.description}</p>
                  {s.fields?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Suggested fields
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
                        {s.fields.slice(0, 8).map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.backPage && (
                    <p className="mt-2 text-xs text-gray-500">
                      <span className="font-semibold">Back page:</span> {s.backPage}
                    </p>
                  )}
                  <button
                    onClick={() => useSuggestion(s)}
                    className="mt-3 rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Use this → upload PDF
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">
            AI suggests the layout, palette, and fields. You still upload your PDF
            design and position the fields in the designer — your artwork stays
            exactly as you made it.
          </p>
        </div>
      )}
    </div>
  );
}
