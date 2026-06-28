import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// This module exposes two Supabase clients:
//   - createSupabaseServerClient(): RLS-scoped, bound to the user's session.
//   - createSupabaseServiceClient(): service-role, BYPASSES RLS (server-only).
// Pick the user-scoped client by default; reach for the service client only on
// the public verification path and background jobs.

/**
 * Supabase client bound to the user's auth cookies. RLS applies — queries
 * only return rows for the user's org. Use in server components & route
 * handlers that act on behalf of the logged-in user.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );
}

/**
 * Service-role client. BYPASSES RLS — server-only, never expose to the client.
 * Used by the PUBLIC verification endpoint (no user session) and by background
 * bulk jobs. Always scope your queries manually when using this.
 */
import { createClient } from "@supabase/supabase-js";
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
