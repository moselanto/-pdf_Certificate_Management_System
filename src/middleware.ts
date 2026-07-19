import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

// Refreshes the Supabase auth session on every request (following the official
// @supabase/ssr pattern) and guards the authenticated app.
//
// CRITICAL: the same `response` object whose cookies we mutate must be the one
// we return, so refreshed session cookies are forwarded to the browser AND are
// visible to downstream server route handlers. Calling supabase.auth.getUser()
// here is what triggers the cookie refresh. Public routes are allowed through
// without a session.
//
// RESILIENCE: the auth check is a NETWORK call to Supabase. If that backend is
// slow or unreachable (for example a free-tier project that was auto-paused
// after inactivity), the call can hang until Vercel kills the whole request
// with a 504 (MIDDLEWARE_INVOCATION_TIMEOUT) — taking the ENTIRE site down. To
// avoid that we race getUser() against a short timeout and, on timeout/error,
// treat the request as having no verified user: protected pages fall through to
// the /login redirect (which renders without the backend) instead of 504-ing.
const PUBLIC_PREFIXES = [
  "/verify",
  "/login",
  "/auth",
  "/api/verify",
  "/_next",
  "/favicon",
  // Static brand assets in /public — must never be redirected to /login,
  // or the logo/icon render as broken images.
  "/logo",
  "/icon",
  "/apple-touch-icon",
];

// Max time to wait for the Supabase auth check before giving up, so a slow or
// paused backend degrades gracefully instead of timing out the whole request.
const AUTH_TIMEOUT_MS = 4000;

// Shape of a single cookie passed to the SSR client's setAll callback.
type CookieToSet = { name: string; value: string; options: CookieOptions };

// Resolve/reject `promise` but never wait longer than `ms`.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("supabase-auth-timeout")), ms),
    ),
  ]);
}

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          // Write to BOTH the request (for this pass) and the response (for
          // the browser + downstream handlers).
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // This refreshes the session and, via setAll above, the auth cookies. It is a
  // network call, so we race it against a timeout: if Supabase is slow or
  // unreachable we fall back to "no user" rather than hanging the whole site.
  let user: User | null = null;
  try {
    const { data } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_TIMEOUT_MS,
    );
    user = data.user;
  } catch {
    // Timed out or errored — treat as unauthenticated. Protected pages get sent
    // to /login (which renders without the backend); public routes and the
    // homepage pass through. This keeps the site responsive when the backend is
    // temporarily unavailable instead of returning a site-wide 504.
    user = null;
  }

  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Only redirect un-authenticated users away from protected PAGES. API routes
  // return their own 401 JSON, so we don't redirect those.
  if (!user && !isPublic && !pathname.startsWith("/api") && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
