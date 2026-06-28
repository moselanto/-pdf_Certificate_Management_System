// POST /auth/signout — clears the Supabase session cookie and returns to login.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
