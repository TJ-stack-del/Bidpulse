"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  event_detail: { text?: string } | null;
  created_at: string;
  team_members: { full_name: string } | null;
};

export function AdminNotes({
  bidId,
  orgId,
  actorId,
  notes,
}: {
  bidId: string;
  orgId: string;
  actorId: string;
  notes: Note[];
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    setError(null);

    const { error: insertError } = await supabase.from("audit_log").insert({
      bid_id: bidId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "note",
      event_detail: { text: text.trim() },
    });

    setPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {notes.length > 0 ? (
        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
          {notes.map((note) => (
            <div key={note.id} className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-label-md text-on-surface">{note.team_members?.full_name ?? "Unknown"}</span>
                <span className="text-code-sm text-on-surface-variant">
                  {new Date(note.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-body-md text-on-surface-variant">{note.event_detail?.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant">No notes yet.</p>
      )}

      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter compliance or technical notes here..."
          rows={3}
          className="w-full border border-outline-variant rounded-lg p-3 pr-24 text-body-md bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none"
        />
        <button
          onClick={handlePost}
          disabled={posting || !text.trim()}
          className="absolute bottom-3 right-3 px-4 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-secondary text-label-md rounded border border-outline-variant/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {posting ? "Posting…" : "Post Note"}
        </button>
      </div>
    </div>
  );
}
