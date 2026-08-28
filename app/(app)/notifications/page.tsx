import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { NotificationsList } from "./NotificationsList";

// Converted from mockups-reference/notification_center_desktop/code.html
// (and notifications_mobile). Reads real notifications rows for this org —
// nothing in this app currently writes notification rows (no trigger or
// scheduled job creates them), so a fresh install honestly shows an empty
// state here rather than fabricated sample items.

const TYPE_ICON: Record<string, string> = {
  new_match: "insights",
  compliance_alert: "error",
  deadline: "schedule",
  review_requested: "rate_review",
  ticket_update: "support_agent",
  audit_event: "history",
};

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/notifications">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, bid_id, read, created_at")
    .eq("org_id", member.org_id)
    .or(`recipient_id.eq.${member.id},recipient_id.is.null`)
    .order("created_at", { ascending: false });

  return (
    <AppShell activePath="/notifications">
      <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Notification Center</h1>
      <p className="text-body-lg text-on-surface-variant mb-4">
        Review compliance tasks and system updates for your organization.
      </p>

      <NotificationsList notifications={notifications ?? []} typeIcons={TYPE_ICON} />
    </AppShell>
  );
}
