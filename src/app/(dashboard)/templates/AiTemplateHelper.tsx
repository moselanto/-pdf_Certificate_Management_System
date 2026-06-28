"use client";

// AI template helper: a collapsible panel on the Templates page.
//
// The user types a free-text brief OR answers a few guided questions, and we
// generate SEVERAL visually DISTINCT certificate background images (real
// artwork, not just text). Each sample shows a thumbnail. The user can:
//   - "Generate more" — replace the set with a fresh batch of different designs
//   - "Use this template" — auto-create a real, ready-to-use template from the
//     chosen background (NO manual PDF upload). The standard fields are
//     auto-placed; the user is taken straight into the designer to fine-tune.

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Suggestion {
  id: string;
  name: string;
  description: string;
  palette: string[];
  fields: string[];
  backPage?: string;
  imageUrl: string;
  imageContentUri: string; // storage path passed to /api/templates/from-ai
  orientation: "landscape" | "portrait";
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Bumped on every "Generate more" so the backend rotates to a fresh design set.
  const [variation, setVariation] = useState(0);
  // Which suggestion is currently being turned into a template.
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const run = async (nextVariation: number) => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const base =
        mode === "brief"
          ? { brief: brief.trim() }
          : { purpose, audience, tone, orientation, includeBack };
      const res = await fetch("/api/templates/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, variation: nextVariation, count: 3 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate designs");
      setSuggestions(json.suggestions ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generate = () => {
    setVariation(0);
    run(0);
  };

  const generateMore = () => {
    const next = variation + 3;
    setVariation(next);
    run(next);
  };

  // Create a real template from the chosen background and open the designer.
  const useSuggestion = async (s: Suggestion) => {
    setCreatingId(s.id);
    setError(null);
    try {
      const res = await fetch("/api/templates/from-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageStoragePath: s.imageContentUri,
          name: s.name,
          orientation: s.orientation,
          includeBack: Boolean(s.backPage),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create the template");
      // Straight into the designer to fine-tune the auto-placed fields.
      router.push(`/templates/${json.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreatingId(null);
    }
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
        <span className="text-xs text-brand-700">
          {open ? "Hide" : "Generate certificate designs"}
        </span>
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generate}
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Generating designs…" : "Generate designs"}
            </button>
            {suggestions.length > 0 && !loading && (
              <button
                onClick={generateMore}
                disabled={loading}
                className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                Generate more
              </button>
            )}
            {loading && (
              <span className="text-xs text-gray-400">
                Creating distinct designs — this can take up to a minute.
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  {/* Real generated background preview */}
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-50 text-xs text-gray-400">
                      preview unavailable
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
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
                    {s.backPage && (
                      <p className="mt-2 text-xs text-gray-500">
                        <span className="font-semibold">Back page:</span> {s.backPage}
                      </p>
                    )}
                    <button
                      onClick={() => useSuggestion(s)}
                      disabled={creatingId !== null}
                      className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {creatingId === s.id ? "Creating template…" : "Use this template"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">
            AI generates real certificate backgrounds. "Use this template" creates
            the template and auto-places the standard fields (recipient, course,
            date, signature, QR, and more) — no PDF upload needed. You can fine-tune
            everything in the designer afterwards.
          </p>
        </div>
      )}
    </div>
  );
}
