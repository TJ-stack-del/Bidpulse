"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Deliverable = {
  id: string;
  artifact_type: string;
  title: string;
  file_url: string | null;
  version: number;
  created_at: string;
};

type Comment = {
  id: string;
  feedback: string | null;
  created_at: string;
  team_members: { full_name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-[#e6f4ea] text-[#1e8e3e] border-[#1e8e3e]/20",
  changes_requested: "bg-error-container text-on-error-container border-on-error-container/20",
};

export function ReviewPortalPanel({
  deliverables,
  latestDecisionByDeliverable,
  generalComments,
  bidId,
  orgId,
  actorId,
}: {
  deliverables: Deliverable[];
  latestDecisionByDeliverable: Record<string, string>;
  generalComments: Comment[];
  bidId: string;
  orgId: string;
  actorId: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function approve(deliverableId: string) {
    setBusyId(deliverableId);
    setError(null);

    const { error: insertError } = await supabase.from("client_reviews").insert({
      bid_id: bidId,
      reviewer_id: actorId,
      deliverable_id: deliverableId,
      decision: "approved",
    });

    setBusyId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.refresh();
  }

  async function postComment() {
    if (!comment.trim()) return;
    setPosting(true);
    setError(null);

    const { error: insertError } = await supabase.from("client_reviews").insert({
      bid_id: bidId,
      reviewer_id: actorId,
      feedback: comment.trim(),
    });

    setPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setComment("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deliverables.map((d) => {
          const decision = latestDecisionByDeliverable[d.id];
          return (
            <div key={d.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-title-lg text-on-surface leading-tight">{d.title}</h3>
                  <p className="text-label-md text-on-surface-variant mt-0.5">
                    {d.artifact_type.replace("_", " ")} · v{d.version}
                  </p>
                </div>
                <span
                  className={`text-label-md px-2 py-1 rounded-full border ${
                    decision ? STATUS_STYLE[decision] : "bg-surface-variant text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {decision === "approved" ? "Approved" : decision === "changes_requested" ? "Changes Req." : "Pending"}
                </span>
              </div>
              <div className="flex-1 text-body-md text-on-surface-variant">
                Logged {new Date(d.created_at).toLocaleDateString()}
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t border-outline-variant">
                {d.file_url && (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-surface border border-outline-variant text-on-surface text-label-md py-2 rounded text-center hover:bg-surface-container transition-colors"
                  >
                    View
                  </a>
                )}
                <button
                  onClick={() => approve(d.id)}
                  disabled={decision === "approved" || busyId === d.id}
                  className="flex-1 bg-surface border border-outline-variant text-on-surface text-label-md py-2 rounded hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {decision === "approved" ? "Approved" : busyId === d.id ? "Approving…" : "Approve"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col">
        <div className="p-4 border-b border-outline-variant bg-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant">forum</span>
          <h3 className="text-title-lg text-on-surface">Reviewer Feedback</h3>
        </div>
        <div className="p-4 flex flex-col gap-4 max-h-[300px] overflow-y-auto">
          {generalComments.length > 0 ? (
            generalComments.map((c) => (
              <div key={c.id} className="bg-surface p-3 rounded-lg border border-outline-variant text-body-md">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-label-md font-bold text-on-surface">
                    {c.team_members?.full_name ?? "Unknown"}
                  </span>
                  <span className="text-code-sm text-on-surface-variant">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-on-surface-variant">{c.feedback}</p>
              </div>
            ))
          ) : (
            <p className="text-body-md text-on-surface-variant">No comments yet.</p>
          )}
        </div>
        <div className="p-4 border-t border-outline-variant bg-surface">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Log comments or request specific changes here..."
            rows={3}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={postComment}
              disabled={posting || !comment.trim()}
              className="bg-secondary text-on-secondary text-label-md px-4 py-2 rounded hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {posting ? "Posting…" : "Post Comment"}
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
