// GET /auth/callback?code=... — exchanges an email-confirmation / OAuth code
// for a session, then redirects into the app. Used when Supabase email
// confirmation (or a magic link) is enabled.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const db = createSupabaseServerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }
  // Fall back to the login page on any failure.
  return NextResponse.redirect(new URL("/login", req.url));
}
