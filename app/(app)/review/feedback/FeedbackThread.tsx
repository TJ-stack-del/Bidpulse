"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ThreadItem = {
  id: string;
  decision: string | null;
  feedback: string | null;
  created_at: string;
  team_members: { full_name: string } | null;
};

export function FeedbackThread({
  thread,
  deliverableTitle,
  deliverableId,
  bidId,
  orgId,
  actorId,
}: {
  thread: ThreadItem[];
  deliverableTitle: string;
  deliverableId: string;
  bidId: string;
  orgId: string;
  actorId: string;
}) {
  const [text, setText] = useState("");
  const [decision, setDecision] = useState<"" | "approved" | "changes_requested">("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handlePost() {
    if (!text.trim() && !decision) return;
    setPosting(true);
    setError(null);

    const { error: insertError } = await supabase.from("client_reviews").insert({
      bid_id: bidId,
      reviewer_id: actorId,
      deliverable_id: deliverableId,
      feedback: text.trim() || null,
      decision: decision || null,
    });

    setPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setText("");
    setDecision("");
    router.refresh();
  }

  return (
    <>
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 max-h-[400px]">
        {thread.length > 0 ? (
          thread.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <span className="text-label-md font-bold text-on-surface">
                  {item.team_members?.full_name ?? "Unknown"}
                </span>
                <span className="text-code-sm text-on-surface-variant">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>
              {item.feedback && (
                <div className="bg-surface-container p-3 rounded rounded-tl-none text-body-md text-on-surface border border-outline-variant/50">
                  {item.feedback}
                </div>
              )}
              {item.decision && (
                <span
                  className={`self-start text-label-md px-2 py-0.5 rounded-full border ${
                    item.decision === "approved"
                      ? "bg-[#e6f4ea] text-[#1e8e3e] border-[#1e8e3e]/20"
                      : "bg-error-container text-on-error-container border-on-error-container/20"
                  }`}
                >
                  {item.decision === "approved" ? "Approved" : "Changes Requested"}
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="text-body-md text-on-surface-variant">No feedback yet on {deliverableTitle}.</p>
        )}
      </div>

      <div className="p-4 border-t border-outline-variant bg-surface-bright">
        {error && <p className="text-body-md text-error mb-2">{error}</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Add feedback or request changes for ${deliverableTitle}...`}
          rows={3}
          className="w-full border border-outline-variant rounded p-3 text-body-md text-on-surface focus:border-secondary-container focus:ring-1 focus:ring-secondary-container resize-none bg-surface-container-lowest"
        />
        <div className="flex flex-wrap justify-between items-center gap-2 mt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDecision(decision === "approved" ? "" : "approved")}
              className={`px-3 py-1.5 rounded text-label-md border transition-colors ${
                decision === "approved"
                  ? "bg-[#e6f4ea] text-[#1e8e3e] border-[#1e8e3e]"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecision(decision === "changes_requested" ? "" : "changes_requested")}
              className={`px-3 py-1.5 rounded text-label-md border transition-colors ${
                decision === "changes_requested"
                  ? "bg-error-container text-on-error-container border-on-error-container"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              Request Changes
            </button>
          </div>
          <button
            onClick={handlePost}
            disabled={posting || (!text.trim() && !decision)}
            className="bg-secondary-container text-on-secondary px-4 py-2 rounded text-label-md hover:bg-on-background transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {posting ? "Posting…" : "Post Feedback"}
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </>
  );
}
