import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/Toast";
import { AppShell } from "@/components/ui/AppShell";

// Mounts AppShell once for the whole /admin section instead of each page
// doing it individually -- see AppShell.tsx's own comment for why that
// used to cause a full header/sidebar remount (and visible flash) on
// every navigation between admin pages. This only fetches the sliver of
// the team_members row AppShell actually needs (full_name); each page
// still does its own full fetch for the data it renders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) redirect("/");

  return (
    <ToastProvider>
      <AppShell role="admin" viewerName={member.full_name}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
