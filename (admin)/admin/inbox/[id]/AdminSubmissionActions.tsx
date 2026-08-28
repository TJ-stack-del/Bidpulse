"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function AdminSubmissionActions({
  submissionId,
  currentStage,
  checklist,
  notes,
}: {
  submissionId: string;
  currentStage: string;
  checklist: ChecklistItem[];
  notes: Note[];
}) {
  const [stage, setStage] = useState(currentStage);
  const [noteText, setNoteText] = useState("");
  const [localNotes, setLocalNotes] = useState(notes);
  const [savingStage, setSavingStage] = useState(false);
  const supabase = createClient();

  async function handleStageChange(newStage: string) {
    setSavingStage(true);
    await supabase.from("submissions").update({ stage: newStage }).eq("id", submissionId);

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      event_type: "stage_change",
      event_detail: { from: stage, to: newStage },
    });

    setStage(newStage);
    setSavingStage(false);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;

    const { data: newNote } = await supabase
      .from("admin_notes")
      .insert({ submission_id: submissionId, note: noteText })
      .select()
      .single();

    if (newNote) {
      setLocalNotes((n) => [newNote, ...n]);
      setNoteText("");
    }
  }

  async function handleChecklistChange(itemId: string, newStatus: string) {
    await supabase.from("checklist_items").update({ status: newStatus }).eq("id", itemId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-on-surface mb-4">Move to stage</h2>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => handleStageChange(s)}
              disabled={savingStage}
              className={`px-3 py-2 rounded text-label-md border transition-colors disabled:opacity-40 ${
                stage === s
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface border-outline-variant text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {checklist.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="text-title-lg text-on-surface mb-4">Compliance checklist</h2>
          <div className="flex flex-col gap-3">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-body-md text-on-surface">{item.label}</span>
                <select
                  defaultValue={item.status}
                  onChange={(e) => handleChecklistChange(item.id, e.target.value)}
                  className="px-2 py-1 rounded border border-outline-variant bg-surface text-body-md text-on-surface"
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-on-surface mb-4">Internal notes</h2>
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
            className="px-4 py-2 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors"
          >
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
