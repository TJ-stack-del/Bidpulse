"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";

type Note = { id: string; note: string; created_at: string };
type ChecklistItem = { id: string; label: string; status: string; notes: string | null };

const STAGES = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "confirmed_submitted",
  "closed",
];

// Human text for the notify route's non-error "not sent" reasons — these
// aren't failures, so they're shown in a neutral tone, not error red.
const SKIP_REASON_LABELS: Record<string, string> = {
  test_submission: "test submission — no email sent",
  no_client_email: "client has no email on file",
  no_template_for_stage: "no email template for this stage",
};

export function AdminSubmissionActions({
  submissionId,
  orgId,
  actorId,
  currentStage,
  checklist,
  notes,
  clientReportedSubmittedAt,
}: {
  submissionId: string;
  orgId: string;
  actorId: string;
  currentStage: string;
  checklist: ChecklistItem[];
  notes: Note[];
  clientReportedSubmittedAt: string | null;
}) {
  const [stage, setStage] = useState(currentStage);
  const [noteText, setNoteText] = useState("");
  const [localNotes, setLocalNotes] = useState(notes);
  const [localChecklist, setLocalChecklist] = useState(checklist);
  const [checklistLabel, setChecklistLabel] = useState("");
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [savingStage, setSavingStage] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [notifySkipReason, setNotifySkipReason] = useState<string | null>(null);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [savedChecklistIds, setSavedChecklistIds] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  async function handleStageChange(newStage: string) {
    setSavingStage(true);
    setNotifyError(null);
    setNotifySkipReason(null);
    setNotifySuccess(false);

    const nowIso = new Date().toISOString();
    await supabase
      .from("submissions")
      .update({ stage: newStage, updated_at: nowIso })
      .eq("id", submissionId);

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "stage_change",
      event_detail: { from: stage, to: newStage },
    });

    setStage(newStage);
    setSavingStage(false);

    // The stage change itself already succeeded above — a failure here
    // (e.g. Resend's test-mode recipient restriction) shouldn't look like
    // the stage change failed, so it's surfaced as its own small note.
    try {
      const res = await fetch("/api/notify-stage-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, newStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send the client notification email.");
      if (data.sent) {
        setNotifySuccess(true);
      } else {
        setNotifySkipReason(data.reason ?? "skipped");
      }
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : "Couldn't send the client notification email.");
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);

    const { data: newNote } = await supabase
      .from("admin_notes")
      .insert({ submission_id: submissionId, author_id: actorId, note: noteText })
      .select()
      .single();

    if (newNote) {
      setLocalNotes((n) => [newNote, ...n]);
      setNoteText("");
    }
    setAddingNote(false);
  }

  async function handleChecklistChange(itemId: string, newStatus: string) {
    const { error } = await supabase.from("checklist_items").update({ status: newStatus }).eq("id", itemId);
    if (!error) {
      setSavedChecklistIds((s) => ({ ...s, [itemId]: true }));
      setTimeout(() => setSavedChecklistIds((s) => ({ ...s, [itemId]: false })), 1500);
    }
  }

  async function handleAddChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!checklistLabel.trim()) return;
    setAddingChecklistItem(true);
    setChecklistError(null);

    const { data: newItem, error } = await supabase
      .from("checklist_items")
      .insert({ submission_id: submissionId, label: checklistLabel.trim() })
      .select()
      .single();

    if (error || !newItem) {
      setChecklistError(error?.message ?? "Couldn't add that item.");
    } else {
      setLocalChecklist((c) => [...c, newItem]);
      setChecklistLabel("");
    }
    setAddingChecklistItem(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {clientReportedSubmittedAt && stage !== "confirmed_submitted" && stage !== "closed" && (
        <div className="bg-secondary-container border border-secondary/30 rounded-xl p-6">
          <h2 className="text-title-lg text-on-secondary-container mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">flag</span>
            Client reports this was submitted
          </h2>
          <p className="text-body-md text-on-secondary-container">
            On {new Date(clientReportedSubmittedAt).toLocaleString()} — confirm below by moving the stage to
            &quot;confirmed submitted&quot; once you&apos;ve verified it.
          </p>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">timeline</span>
          Move to stage
          {savingStage && <Spinner className="text-secondary" />}
        </h2>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => handleStageChange(s)}
              disabled={savingStage}
              className={`px-3 py-2 rounded text-label-md border transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${
                stage === s
                  ? "bg-secondary text-on-secondary border-secondary"
                  : "bg-surface border-outline-variant text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <FadeMessage show={notifySuccess} className="text-body-md text-secondary block mt-3">
          Client notified by email.
        </FadeMessage>
        {notifySkipReason && (
          <p className="text-body-md text-on-surface-variant mt-3">
            Client not notified — {SKIP_REASON_LABELS[notifySkipReason] ?? notifySkipReason}.
          </p>
        )}
        {notifyError && (
          <p className="text-body-md text-error mt-3">
            Stage saved, but the client wasn&apos;t notified: {notifyError}
          </p>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">fact_check</span>
          Compliance checklist
        </h2>
        {/* Shows up on the client's own dashboard as "What we still need
            from you" — this is the only way to put something on that list. */}
        <form onSubmit={handleAddChecklistItem} className="flex gap-2 mb-4">
          <input
            type="text"
            value={checklistLabel}
            onChange={(e) => setChecklistLabel(e.target.value)}
            placeholder="e.g. Complete your Company Profile (address, phone, insurance)…"
            className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
          />
          <button
            type="submit"
            disabled={addingChecklistItem}
            className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
          >
            {addingChecklistItem && <Spinner />}
            Add
          </button>
        </form>
        {checklistError && <p className="text-body-md text-error mb-4">{checklistError}</p>}

        {localChecklist.length > 0 ? (
          <div className="flex flex-col gap-3">
            {localChecklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-body-md text-on-surface">{item.label}</span>
                <div className="flex items-center gap-2">
                  <FadeMessage show={!!savedChecklistIds[item.id]} className="text-label-md text-secondary">
                    Saved
                  </FadeMessage>
                  <select
                    defaultValue={item.status}
                    onChange={(e) => handleChecklistChange(item.id, e.target.value)}
                    className="px-2 py-1 rounded border border-outline-variant bg-surface text-body-md text-on-surface transition"
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                    <option value="waived">Waived</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-body-md text-on-surface-variant">Nothing on the checklist yet.</p>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">edit_note</span>
          Internal notes
        </h2>
        <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
          />
          <button
            type="submit"
            disabled={addingNote}
            className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
          >
            {addingNote && <Spinner />}
            Add
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {localNotes.map((n) => (
            <li key={n.id} className="text-body-md text-on-surface-variant border-t border-outline-variant pt-2">
              {n.note}
              <span className="text-label-md block mt-1">
                {new Date(n.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
