import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
import { SettingsForm } from "./SettingsForm";

// Settings: organisation name (used as the default "Issued by" on the public
// verification page when a certificate's trainer has no institution), the
// organisation default logo, and a couple of read-only account details.
export default async function SettingsPage() {
  const db = createSupabaseServerClient();

  const { data: auth } = await db.auth.getUser();
  let orgName = "";
  let role = "";
  let email = auth.user?.email ?? "";
  let logoUrl: string | null = null;

  if (auth.user) {
    const { data: profile } = await db
      .from("profiles")
      .select("org_id, role")
      .eq("id", auth.user.id)
      .single();
    role = (profile?.role as string) ?? "";
    if (profile?.org_id) {
      const { data: org } = await db
        .from("organizations")
        .select("name, logo_path")
        .eq("id", profile.org_id)
        .single();
      orgName = (org?.name as string) ?? "";
      if (org?.logo_path) {
        const { data: signed } = await db.storage
          .from(TEMPLATE_BUCKET)
          .createSignedUrl(org.logo_path as string, 60 * 30);
        logoUrl = signed?.signedUrl ?? null;
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500">
          Manage your organisation details. The organisation name is used as the
          default &ldquo;Issued by&rdquo; on certificate verification pages when a
          trainer has no institution set.
        </p>
      </div>

      <SettingsForm
        initialOrgName={orgName}
        initialLogoUrl={logoUrl}
        email={email}
        role={role}
      />
    </div>
  );
}
