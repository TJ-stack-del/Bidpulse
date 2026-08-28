import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { SettingsTabs } from "@/components/ui/SettingsTabs";
import { ApiKeysPanel } from "./ApiKeysPanel";
import { AccountSecurityPanel } from "./AccountSecurityPanel";

// Converted from mockups-reference/security_settings_desktop/code.html (and
// _mobile). MFA enrollment and the active-sessions device list aren't
// backed by anything real here — this app never wires up Supabase Auth's
// MFA factors or session listing — so those sections are dropped in favor
// of two things that genuinely work through supabase-js: changing your
// password and signing out of other sessions
// (auth.signOut({ scope: "others" })). "API Management" is real: it reads
// and writes the actual api_keys table. "Usage (24h)" sparklines and "Last
// Used" timestamps are dropped — no usage-tracking column exists.

export default async function SecuritySettingsPage() {
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
      <AppShell activePath="/settings/security">
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

  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, rate_limit_per_min, created_at, revoked_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  return (
    <AppShell activePath="/settings/security">
      <div className="mt-6">
        <SettingsTabs active="/settings/security" />
      </div>
      <h1 className="text-headline-lg text-on-surface mb-1">Security Settings</h1>
      <p className="text-body-lg text-on-surface-variant mb-4">
        Manage your account security and API access.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <AccountSecurityPanel email={user.email ?? ""} />
        </div>

        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-title-lg text-on-surface mb-1">API Management</h2>
                <p className="text-body-md text-on-surface-variant">
                  Integration keys for external services.
                </p>
              </div>
              <Link href="/docs/api" className="text-secondary text-label-md hover:underline shrink-0">
                API Docs
              </Link>
            </div>
            {permissions?.can_manage_team ? (
              <ApiKeysPanel apiKeys={apiKeys ?? []} orgId={member.org_id} />
            ) : (
              <>
                <ApiKeysList apiKeys={apiKeys ?? []} />
                <p className="text-body-md text-on-surface-variant mt-4">
                  Your role ({member.role}) can't generate or revoke keys — ask a team manager.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ApiKeysList({
  apiKeys,
}: {
  apiKeys: { id: string; key_prefix: string; rate_limit_per_min: number; created_at: string; revoked_at: string | null }[];
}) {
  if (apiKeys.length === 0) {
    return <p className="text-body-md text-on-surface-variant">No API keys yet.</p>;
  }
  return (
    <div className="border border-outline-variant rounded overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-container-low text-label-md text-on-surface-variant border-b border-outline-variant">
          <tr>
            <th className="py-3 px-3 font-medium">Key</th>
            <th className="py-3 px-3 font-medium">Created</th>
            <th className="py-3 px-3 font-medium">Rate Limit</th>
            <th className="py-3 px-3 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody className="text-body-md text-on-surface">
          {apiKeys.map((k) => (
            <tr key={k.id} className="border-b border-outline-variant last:border-b-0">
              <td className="py-2 px-3 font-code text-code-sm">{k.key_prefix}…</td>
              <td className="py-2 px-3 text-code-sm text-on-surface-variant">
                {new Date(k.created_at).toLocaleDateString()}
              </td>
              <td className="py-2 px-3 text-code-sm text-on-surface-variant">{k.rate_limit_per_min}/min</td>
              <td className="py-2 px-3 text-right">
                {k.revoked_at ? (
                  <span className="text-error text-label-md">Revoked</span>
                ) : (
                  <span className="text-on-tertiary-container text-label-md">Active</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
