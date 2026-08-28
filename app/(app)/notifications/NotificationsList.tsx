"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  bid_id: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationsList({
  notifications,
  typeIcons,
}: {
  notifications: Notification[];
  typeIcons: Record<string, string>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function markRead(id: string) {
    setBusyId(id);
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setBusyId(null);
    router.refresh();
  }

  async function markAllRead() {
    setMarkingAll(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    }
    setMarkingAll(false);
    router.refresh();
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="text-secondary text-label-md hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      )}

      {notifications.length > 0 ? (
        notifications.map((n) => (
          <div
            key={n.id}
            className={`bg-surface-container-lowest border rounded p-4 flex gap-4 transition-colors ${
              n.read ? "border-outline-variant opacity-80" : "border-l-4 border-l-secondary border-y border-r border-outline-variant"
            }`}
          >
            <span className="material-symbols-outlined text-secondary mt-1 shrink-0">
              {typeIcons[n.type] ?? "notifications"}
            </span>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1 gap-4">
                <h3 className="text-title-lg text-on-surface">{n.title}</h3>
                <span className="text-code-sm text-on-surface-variant shrink-0">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
              {n.body && <p className="text-body-md text-on-surface-variant mb-3">{n.body}</p>}
              <div className="flex gap-3 items-center">
                <span className="bg-surface-container-high text-on-surface-variant text-label-md px-2 py-1 rounded-full border border-outline-variant">
                  {n.type.replace("_", " ")}
                </span>
                {n.bid_id && (
                  <Link href={`/intake?bid=${n.bid_id}`} className="text-secondary text-label-md hover:underline">
                    View Bid →
                  </Link>
                )}
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    disabled={busyId === n.id}
                    className="text-on-surface-variant text-label-md hover:underline disabled:opacity-50"
                  >
                    {busyId === n.id ? "Marking…" : "Mark as read"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="text-body-md text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-6">
          No notifications yet.
        </p>
      )}
    </div>
  );
}
