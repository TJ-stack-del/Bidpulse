import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { SettingsTabs } from "@/components/ui/SettingsTabs";
import { RolePermissionsEditor } from "./RolePermissionsEditor";

// Converted from mockups-reference/role_permissions_desktop/code.html.
// That mockup shows ~8 fine-grained per-module toggles ("View
// Opportunities", "Edit Pipeline State", "Approve Matrix", "Seal Final
// Package", ...) that don't correspond to anything in schema.sql —
// role_permissions has exactly 5 real boolean columns, and those are what
// every permission check across this app actually reads. So this edits
// those 5, described in terms of what they actually gate here, instead of
// fabricating a richer permission model that nothing enforces.
//
// Gated by can_view_admin per README section 5 — role_permissions is the
// most sensitive table in the schema, and only platform_admin has that
// flag by default.

export default async function RolePermissionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/settings/roles">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: myPermissions } = await supabase
    .from("role_permissions")
    .select("can_view_admin")
    .eq("role", member.role)
    .single();

  if (!myPermissions?.can_view_admin) {
    return (
      <AppShell activePath="/settings/roles">
        <p className="text-body-md text-error mt-6">
          Your role ({member.role}) doesn't have admin portal access.
        </p>
      </AppShell>
    );
  }

  const [{ data: allPermissions }, { data: roster }] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("role, can_view_admin, can_view_margin_data, can_sign_off, can_manage_team, can_export_audit_log")
      .order("role", { ascending: true }),
    supabase.from("team_members").select("role").eq("org_id", member.org_id),
  ]);

  const activeCounts = (roster ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell activePath="/settings/roles">
      <div className="mt-6">
        <SettingsTabs active="/settings/roles" />
      </div>
      <h1 className="text-headline-lg text-on-surface mb-1">Role Permissions</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        These 5 flags are what every permission check in BidPulse actually reads — editing them
        changes real access immediately.
      </p>

      <RolePermissionsEditor roles={allPermissions ?? []} activeCounts={activeCounts} />
    </AppShell>
  );
}
