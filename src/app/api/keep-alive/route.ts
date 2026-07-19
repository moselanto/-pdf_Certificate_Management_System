import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// GET /api/keep-alive
//
// Lightweight endpoint whose only job is to run one trivial database query so
// the Supabase project registers activity. Supabase's free tier auto-pauses a
// project after ~7 days of inactivity, which takes the whole site down until it
// is manually resumed. A Vercel Cron Job (see vercel.json) calls this once a day
// so the project never goes idle.
//
// Safe to call publicly: it performs a HEAD count (fetches no rows) and returns
// only a status object, never any data.

export const runtime = "nodejs";
// Never cache — every hit must actually reach the database.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createSupabaseServiceClient();
    // Cheapest read that still touches Postgres: a HEAD count returns no rows,
    // just enough of a query to count as database activity.
    const { error } = await db
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
