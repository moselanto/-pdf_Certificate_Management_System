import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refreshes the Supabase auth session on every request (following the official
// @supabase/ssr pattern) and guards the authenticated app.
//
// CRITICAL: the same `response` object whose cookies we mutate must be the one
// we return, so refreshed session cookies are forwarded to the browser AND are
// visible to downstream server route handlers. Calling supabase.auth.getUser()
// here is what triggers the cookie refresh. Public routes are allowed through
// without a session.
const PUBLIC_PREFIXES = [
  "/verify",
  "/login",
  "/auth",
  "/api/verify",
  "/_next",
  "/favicon",
];

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
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

  // This refreshes the session and, via setAll above, the auth cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
