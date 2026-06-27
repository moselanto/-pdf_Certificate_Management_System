// POST /api/certificates/[id]/email — email a generated certificate to its
// recipient. Body (optional): { "to": "override@example.com" }. If omitted, the
// linked trainee's email is used. Flips status to "emailed" on success.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendCertificateEmail } from "@/lib/services/sendCertificateEmail";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z
  .object({ to: z.string().email().optional() })
  .optional()
  .default({});

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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = createSupabaseServerClient();
  const ctx = await currentContext(db);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Body is optional; tolerate an empty request.
    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw);

    const result = await sendCertificateEmail(db, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      certificateId: params.id,
      toEmail: body?.to,
    });

    return NextResponse.json({ sent: true, to: result.to, providerId: result.providerId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
