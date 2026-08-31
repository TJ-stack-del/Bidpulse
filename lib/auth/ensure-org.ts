import type { SupabaseClient, User } from "@supabase/supabase-js";

// Single-tenant business: there's exactly one organization and no
// legitimate way through the UI to create a second one (the admin signup
// form this used to be reached from has been removed). This is now purely
// a self-heal path — see app/page.tsx, which only calls it when neither a
// team_members nor a clients row exists yet AND the account carries
// admin-signup metadata from before that form was removed, i.e. an account
// that had to confirm its email and never got its team_members row created
// (no session existed yet at signup time to do the insert). Attaches to
// the existing organization rather than creating a new one — same "first
// org in the system is the org" assumption IntakeWizard.tsx makes for
// clients — and only falls back to creating one in the genuine bootstrap
// case where none exists yet at all.
export async function ensureOrgAndMembership(
  supabase: SupabaseClient,
  user: User,
  overrides?: { fullName?: string; orgName?: string }
) {
  const { data: existingMember } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingMember) return;

  const fullName =
    overrides?.fullName ?? (user.user_metadata?.full_name as string | undefined) ?? "New User";

  const { data: existingOrg } = await supabase.from("organizations").select("id").limit(1).maybeSingle();

  let orgId = existingOrg?.id as string | undefined;

  if (!orgId) {
    const orgName =
      overrides?.orgName ?? (user.user_metadata?.org_name as string | undefined) ?? "My Organization";

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgError || !org) {
      throw new Error(orgError?.message ?? "Failed to create organization.");
    }

    orgId = org.id;
  }

  const { error: memberError } = await supabase.from("team_members").insert({
    org_id: orgId,
    auth_user_id: user.id,
    full_name: fullName,
    email: user.email ?? "",
    role: "admin",
  });

  if (memberError) {
    throw new Error(memberError.message);
  }
}
