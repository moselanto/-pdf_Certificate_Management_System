"use client";

// Email + password sign-in / sign-up against Supabase Auth.
// On success, the session cookie is set and we redirect into the dashboard.
//
// NOTE: a new auth user still needs a matching `profiles` row (org + role)
// to use the app — see docs/SETUP.md step 5. Sign-up here creates the auth
// user; link the profile via SQL (or a future invite flow).

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      return setError("Enter your email and password.");
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setInfo(
          "Account created. If email confirmation is on, confirm via the link we sent, then sign in. An admin must link your profile (org + role) — see SETUP.md.",
        );
        setMode("signin");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          {/* Plain <img> (not next/image): serves the raw SVG from /public and
              avoids the image optimizer, which the auth middleware redirects. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="CertForge" className="h-10 w-auto" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {mode === "signin"
            ? "Access your certificate dashboard."
            : "Set up a new login for CertForge."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <label className="block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              suppressHydrationWarning
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div suppressHydrationWarning>
            <label className="block text-sm font-semibold text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="••••••••"
              suppressHydrationWarning
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {info && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{info}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm text-brand-700 hover:underline"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
