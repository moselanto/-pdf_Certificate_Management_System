"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for auth (sign in / sign up / sign out).
// Uses the anon key; all data access remains RLS-scoped to the user's org.
// Cookies are shared with the server client + middleware so the session stays
// in sync across server components, route handlers, and the browser.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
