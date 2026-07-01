import { createSupabaseServerClient } from "@/lib/supabase/server";

// Server component: shows the signed-in user's email and a sign-out button.
// Sign-out posts to /auth/signout which clears the session cookie.
export async function UserMenu() {
  const db = createSupabaseServerClient();
  const { data } = await db.auth.getUser();
  const email = data.user?.email;

  // Try to surface the user's role for a little context.
  let role: string | null = null;
  if (data.user) {
    const { data: profile } = await db
      .from("profiles")
      .select("role, full_name")
      .eq("id", data.user.id)
      .single();
    role = profile?.role ?? null;
  }

  if (!email) {
    return (
      <a href="/login" className="text-sm font-medium text-brand-700 hover:underline">
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm font-medium text-gray-800">{email}</div>
        {role && <div className="text-xs capitalize text-gray-400">{role}</div>}
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
