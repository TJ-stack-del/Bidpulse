import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { AuditLogExportControls } from "./AuditLogExportControls";

// Converted from mockups-reference/audit_log_export_desktop/code.html —
// keeps the SHA-256 manifest / CSV / JSON export idea from that mockup's
// AI Studio prototype, but reads real rows from `audit_log` (see
// schema.sql) instead of hardcoded fake entries.

export default async function AuditLogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppShell activePath="/admin/audit-log">
        <p className="text-body-md text-on-surface-variant mt-6">
          Please log in to view the audit log.
        </p>
      </AppShell>
    );
  }

  // Gate this page by role_permissions.can_export_audit_log, per README
  // section 5 — don't rely on hiding the nav link alone.
  const { data: member } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!member) {
    return (
      <AppShell activePath="/admin/audit-log">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: permissions } = await supabase
    .from("role_permissions")
    .select("can_export_audit_log")
    .eq("role", member.role)
    .single();

  if (!permissions?.can_export_audit_log) {
    return (
      <AppShell activePath="/admin/audit-log">
        <p className="text-body-md text-error mt-6">
          Your role ({member.role}) doesn't have audit log export access.
        </p>
      </AppShell>
    );
  }

  // Pull audit_log rows for this org, joined to team_members for the
  // actor's name (audit_log only stores actor_id, per schema.sql).
  const { data: rawLogs } = await supabase
    .from("audit_log")
    .select("id, bid_id, event_type, event_detail, created_at, actor_id, team_members(full_name)")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(1000);

  const logs = (rawLogs ?? []).map((row: any) => ({
    id: row.id,
    bid_id: row.bid_id,
    event_type: row.event_type,
    event_detail: row.event_detail,
    created_at: row.created_at,
    actor_name: row.team_members?.full_name ?? null,
  }));

  return (
    <AppShell activePath="/admin/audit-log">
      <div className="flex flex-col gap-1 mt-6">
        <p className="text-label-md text-on-surface-variant uppercase tracking-wider">
          Compliance
        </p>
        <h1 className="text-headline-lg text-on-surface">Audit Log Export</h1>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mt-4">
        <p className="text-body-md text-on-surface-variant mb-4">
          {logs.length} record{logs.length === 1 ? "" : "s"} — this table is append-only,
          so what you see here is the real, unedited trail.
        </p>
        <AuditLogExportControls logs={logs} />
      </div>
    </AppShell>
  );
}
