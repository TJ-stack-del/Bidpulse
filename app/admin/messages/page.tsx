import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { SupportMessagesList } from "./SupportMessagesList";

export default async function AdminMessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, name, email, message, read, created_at")
    .order("created_at", { ascending: false });

  return (
    <AppShell activePath="/admin/messages" role="admin" viewerName={member.full_name}>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Support messages</h1>
        <p className="text-body-md text-on-surface-variant">
          Submissions from the /contact form, newest first.
        </p>
      </div>

      <SupportMessagesList messages={messages ?? []} />
    </AppShell>
  );
}
