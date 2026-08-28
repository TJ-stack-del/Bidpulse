import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { ProfileForm } from "./ProfileForm";

// No mockup for this one — AppShell's mobile nav has always linked here,
// but the route never existed. Edits go through the "users can update
// their own team_member row" RLS policy in schema.sql — role/email/org_id
// are pinned back to their old value by a trigger unless the editor has
// can_manage_team(), so this form only exposes full_name and avatar_url.

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, full_name, email, role, avatar_url, created_at, organizations(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/profile">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const org = member.organizations as unknown as { name: string } | null;

  return (
    <AppShell activePath="/profile">
      <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Profile</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        {org?.name ?? "Your organization"} · joined {new Date(member.created_at).toLocaleDateString()}
      </p>

      <div className="max-w-lg bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <ProfileForm
          memberId={member.id}
          fullName={member.full_name}
          avatarUrl={member.avatar_url}
          email={member.email}
          role={member.role}
        />
      </div>
    </AppShell>
  );
}
