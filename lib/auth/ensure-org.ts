import type { SupabaseClient, User } from "@supabase/supabase-js";

// Admin-signup only — never call this for a client sign-in (see
// app/page.tsx, which only calls it when neither a team_members nor a
// clients row exists yet AND the account carries admin-signup metadata).
// Runs once per account, right after we have a *real* session (a live
// Supabase session is what lets RLS's auth.uid() resolve — see the
// "Organizations & Team" policies in schema.sql). Called from
// app/admin/signup/SignupForm.tsx right after supabase.auth.signUp() when
// email confirmation is off and a session comes back immediately, and from
// app/page.tsx as a no-op-if-already-done fallback for accounts that had to
// confirm their email first (no session existed yet at signup time to do
// the insert).
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

  const { error: memberError } = await supabase.from("team_members").insert({
    org_id: org.id,
    auth_user_id: user.id,
    full_name: fullName,
    email: user.email ?? "",
    role: "admin",
  });

  if (memberError) {
    throw new Error(memberError.message);
  }
}
