import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { SettingsTabs } from "@/components/ui/SettingsTabs";
import { TeamRoster } from "./TeamRoster";

// Converted from mockups-reference/team_management_desktop/code.html (plus
// team_directory_mobile / member_access_detail_mobile — same content,
// AppShell already handles the responsive split). "Status" (Active/
// Pending) and "Last Activity" aren't backed by anything and are dropped.
// "Create Invite" can't actually send an email invite — the browser's anon
// key can't call the Supabase Admin API to create a user on someone else's
// behalf (that needs the service_role key, which must never reach the
// browser) — but it CAN do the second half of README step 12's manual
// process: once someone's Auth user exists (created via the Supabase
// dashboard), a can_manage_team member can add their team_members row
// right here instead of going to the Table Editor.

const ROLES = ["platform_admin", "contractor_owner", "contractor_member", "client_reviewer"];

export default async function TeamManagementPage() {
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
      <AppShell activePath="/settings/team">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: permissions } = await supabase
    .from("role_permissions")
    .select("can_manage_team")
    .eq("role", member.role)
    .single();

  const { data: roster } = await supabase
    .from("team_members")
    .select("id, full_name, email, role, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: true });

  return (
    <AppShell activePath="/settings/team">
      <div className="mt-6">
        <SettingsTabs active="/settings/team" />
      </div>
      <h1 className="text-headline-lg text-on-surface mb-1">Team Members</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        Manage organization access and roles.
      </p>

      <TeamRoster
        members={roster ?? []}
        roles={ROLES}
        canManage={!!permissions?.can_manage_team}
        currentMemberId={member.id}
        orgId={member.org_id}
      />

    </AppShell>
  );
}
