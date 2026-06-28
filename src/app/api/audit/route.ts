// GET /api/audit — paginated, org-scoped audit-log feed for the activity viewer.
//
// The audit_logs table already captures every meaningful write (certificate
// generate/email/revoke/delete, template/course/trainer/trainee changes, org
// settings, logo uploads, etc.). RLS scopes rows to the caller's org, so we
// simply read them newest-first. Supports an optional `action` prefix filter
// and keyset pagination via `before` (an ISO created_at cursor).
//
// Query params:
//   - limit:  page size (default 50, max 200)
//   - action: filter to actions starting with this prefix (e.g. "certificate.")
//   - before: ISO timestamp; return rows strictly older than this (pagination)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function currentContext(db: ReturnType<typeof createSupabaseServerClient>) {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("org_id, role")
    .eq("id", auth.user.id)
    .single();
  if (!profile) return null;
  return { userId: auth.user.id, orgId: profile.org_id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 50, 1), 200);
  const action = sp.get("action")?.trim();
  const before = sp.get("before")?.trim();

  let query = db
    .from("audit_logs")
    .select("id, actor_id, action, entity, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.ilike("action", `${action}%`);
  if (before) query = query.lt("created_at", before);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Resolve actor display names in one batched query (RLS lets a user read
  // profiles in their own org). Map id -> full_name, falling back to "System"
  // for null actors (e.g. public verification or service-role writes).
  const actorIds = Array.from(
    new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]),
  );
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: profs } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profs ?? []) names.set(p.id, (p.full_name as string) ?? "");
  }

  const entries = (rows ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
    actorId: r.actor_id,
    actorName: r.actor_id ? names.get(r.actor_id) || "Unknown user" : "System",
  }));

  // Cursor for the next page is the oldest row's timestamp (when full page).
  const nextBefore =
    entries.length === limit ? entries[entries.length - 1].createdAt : null;

  return NextResponse.json({ entries, nextBefore });
}
