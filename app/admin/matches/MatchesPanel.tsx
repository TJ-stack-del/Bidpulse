"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useToast } from "@/components/Toast";

type Match = {
  id: string;
  source_title: string;
  source_agency: string;
  source_url: string | null;
  scope: string | null;
  solicitation_number: string | null;
  due_date: string | null;
  match_score: number | null;
  status: string;
  assigned_client_id: string | null;
  created_at: string;
};

type Client = { id: string; company_name: string };

export function MatchesPanel({
  orgId,
  actorId,
  initialMatches,
  clients,
}: {
  orgId: string;
  actorId: string;
  initialMatches: Match[];
  clients: Client[];
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [logging, setLogging] = useState(false);
  const [title, setTitle] = useState("");
  const [agency, setAgency] = useState("");
  const [scope, setScope] = useState("");
  const [solicitationNumber, setSolicitationNumber] = useState("");
  const [dueDate, setDueDate] = useState("");

  const supabase = createClient();
  const { showToast } = useToast();

  function clientName(clientId: string | null) {
    return clients.find((c) => c.id === clientId)?.company_name ?? "—";
  }

  async function handleLogOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !agency.trim()) return;
    setLogging(true);

    const { data, error: insertError } = await supabase
      .from("matched_opportunities")
      .insert({
        org_id: orgId,
        source_title: title,
        source_agency: agency,
        scope: scope.trim() || null,
        solicitation_number: solicitationNumber.trim() || null,
        due_date: dueDate || null,
        status: "new",
      })
      .select()
      .single();

    setLogging(false);

    if (insertError || !data) {
      showToast(insertError?.message ?? "Couldn't log that opportunity.", "error");
      return;
    }

    setMatches((m) => [data, ...m]);
    setTitle("");
    setAgency("");
    setScope("");
    setSolicitationNumber("");
    setDueDate("");
  }

  async function handleAssign(matchId: string) {
    const clientId = assignSelections[matchId];
    if (!clientId) {
      showToast("Pick a client to assign this to first.", "error");
      return;
    }

    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    setBusyId(matchId);

    // Left as a draft (schema default) rather than immediately finalized —
    // the agency/scope/due date are already known, but the client still
    // needs to attach the actual bid file and send it. See IntakeWizard/
    // dashboard's CompleteBidFile: a client with a draft submission like
    // this one skips straight to "Your bid file" instead of being asked
    // "About the bid" again for something we already know.
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        client_id: clientId,
        agency: match.source_agency,
        scope: match.scope ?? `From matched opportunity: ${match.source_title}`,
        solicitation_number: match.solicitation_number,
        due_date: match.due_date,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      showToast(submissionError?.message ?? "Couldn't create a submission for this client.", "error");
      setBusyId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ assigned_client_id: clientId, status: "assigned" })
      .eq("id", matchId);

    if (updateError) {
      showToast(updateError.message, "error");
      setBusyId(null);
      return;
    }

    await supabase.from("audit_log").insert({
      submission_id: submission.id,
      org_id: orgId,
      actor_id: actorId,
      event_type: "submission_created_from_match",
      event_detail: { opportunity_id: matchId },
    });

    // The intake wizard triggers this right after a client's own submit
    // (lib/submissions.ts finalizeSubmission); a submission created here by
    // an admin assigning a match skips that path entirely, so it has to be
    // kicked off explicitly or the admin inbox's Fit check panel is stuck on
    // "Not run yet" forever for every match-assigned submission. Scope/
    // agency/due date are already real at this point (taken from the
    // matched opportunity), so there's no need to wait for the client to
    // finalize the bid file first — non-fatal if it fails, since a missing
    // fit check shouldn't block the assignment that already succeeded.
    fetch("/api/generate-fit-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: submission.id }),
    }).catch(() => {});

    setMatches((m) =>
      m.map((x) => (x.id === matchId ? { ...x, status: "assigned", assigned_client_id: clientId } : x))
    );
    setBusyId(null);
  }

  async function handleDismiss(matchId: string) {
    setBusyId(matchId);

    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ status: "dismissed" })
      .eq("id", matchId);

    if (updateError) {
      showToast(updateError.message, "error");
      setBusyId(null);
      return;
    }

    setMatches((m) => m.map((x) => (x.id === matchId ? { ...x, status: "dismissed" } : x)));
    setBusyId(null);
  }

  // Works regardless of assignment status, including the common case of a
  // bad/test scraper or email-ingestion result that was never assigned —
  // deleting an already-assigned match here does NOT touch the real
  // submission it produced, only this matched_opportunities row itself.
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    await supabase.from("audit_log").insert({
      org_id: orgId,
      actor_id: actorId,
      event_type: "matched_opportunity_deleted",
      event_detail: {
        matched_opportunity_id: deleteTarget.id,
        source_title: deleteTarget.source_title,
        source_agency: deleteTarget.source_agency,
      },
    });

    const { error } = await supabase.from("matched_opportunities").delete().eq("id", deleteTarget.id);

    if (error) {
      showToast(error.message, "error");
      setDeleting(false);
      return;
    }

    setMatches((m) => m.filter((x) => x.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-6 mt-4">
      <form
        onSubmit={handleLogOpportunity}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-3"
      >
        <div className="flex flex-col md:flex-row gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="text-label-md text-on-surface-variant block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-label-md text-on-surface-variant block mb-1">Agency</label>
            <input
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-label-md text-on-surface-variant block mb-1">Solicitation number</label>
            <input
              value={solicitationNumber}
              onChange={(e) => setSolicitationNumber(e.target.value)}
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-label-md text-on-surface-variant block mb-1">Scope of work</label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={3}
            placeholder="What the job actually involves…"
            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={logging}
          className="self-end py-2 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
        >
          {logging && <Spinner />}
          {logging ? "Logging…" : "Log opportunity"}
        </button>
      </form>

      {/* Table — needs real width for the title/agency/status columns plus
          an inline assign-to select and two buttons in the last one, so
          it's reserved for wide-enough viewports. Below xl, the card list
          further down carries the same data and controls stacked. */}
      <div className="hidden xl:block bg-surface-container-lowest border border-outline-variant rounded-xl">
        <table className="w-full text-body-md table-fixed">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant w-[26%]">Title</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant w-[16%]">Agency</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant w-[10%]">Due</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant w-[8%]">Score</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant w-[14%]">Status</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant w-[26%]"></th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr
                key={m.id}
                className={`border-t border-outline-variant align-top border-l-4 ${
                  m.status === "new" ? "border-l-secondary" : "border-l-transparent"
                } hover:bg-surface-container-low transition`}
              >
                <td className="px-4 py-3 text-on-surface font-semibold break-words">
                  {m.source_url ? (
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-secondary hover:underline"
                    >
                      {m.source_title}
                    </a>
                  ) : (
                    m.source_title
                  )}
                </td>
                <td className="px-4 py-3 text-on-surface-variant break-words">{m.source_agency}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {m.due_date ? new Date(m.due_date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{m.match_score ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill match={m} clientName={clientName} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.status === "new" && (
                      <AssignControls
                        match={m}
                        clients={clients}
                        selected={assignSelections[m.id] ?? ""}
                        onSelect={(v) => setAssignSelections((s) => ({ ...s, [m.id]: v }))}
                        onAssign={() => handleAssign(m.id)}
                        onDismiss={() => handleDismiss(m.id)}
                        busy={busyId === m.id}
                      />
                    )}
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="px-3 py-1.5 rounded border border-error text-error text-label-md hover:bg-error-container/20 transition active:scale-[0.97] shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No opportunities logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Card list — narrower than xl. */}
      <div className="xl:hidden bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
        {matches.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-3 px-4 py-4 border-l-4 ${
              m.status === "new" ? "border-l-secondary" : "border-l-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-on-surface font-semibold break-words">
                  {m.source_url ? (
                    <a href={m.source_url} target="_blank" rel="noreferrer" className="text-secondary hover:underline">
                      {m.source_title}
                    </a>
                  ) : (
                    m.source_title
                  )}
                </p>
                <p className="text-label-md text-on-surface-variant break-words">{m.source_agency}</p>
              </div>
              <StatusPill match={m} clientName={clientName} className="shrink-0" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-md text-on-surface-variant">
              <span>Due: {m.due_date ? new Date(m.due_date).toLocaleDateString() : "—"}</span>
              <span>Score: {m.match_score ?? "—"}</span>
            </div>
            {m.status === "new" && (
              <AssignControls
                match={m}
                clients={clients}
                selected={assignSelections[m.id] ?? ""}
                onSelect={(v) => setAssignSelections((s) => ({ ...s, [m.id]: v }))}
                onAssign={() => handleAssign(m.id)}
                onDismiss={() => handleDismiss(m.id)}
                busy={busyId === m.id}
                stacked
              />
            )}
            <button
              onClick={() => setDeleteTarget(m)}
              className="w-full px-3 py-1.5 rounded border border-error text-error text-label-md hover:bg-error-container/20 transition active:scale-[0.97]"
            >
              Delete
            </button>
          </div>
        ))}
        {matches.length === 0 && (
          <p className="px-4 py-6 text-center text-on-surface-variant">No opportunities logged yet.</p>
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmText={deleteTarget?.source_title ?? ""}
        title="Delete this opportunity?"
        description={
          deleteTarget?.assigned_client_id
            ? `This permanently deletes the "${deleteTarget?.source_title}" opportunity record. It's already assigned to ${clientName(deleteTarget?.assigned_client_id ?? null)} — that client's actual submission is NOT affected, only this review-queue entry.`
            : `This permanently deletes the "${deleteTarget?.source_title}" opportunity record. This cannot be undone.`
        }
        busy={deleting}
      />
    </div>
  );
}

function StatusPill({
  match,
  clientName,
  className = "",
}: {
  match: Match;
  clientName: (id: string | null) => string;
  className?: string;
}) {
  if (match.status === "assigned") {
    // Deliberately ignores the incoming `className` (mobile's caller passes
    // "shrink-0" for the pill badges below) — a flex sibling with
    // flex-shrink: 0 and unbounded text (a long client name) refuses to
    // shrink itself, so the *other* sibling (the title/agency block) was
    // absorbing 100% of the squeeze and collapsing to width: 0, wrapping
    // its own break-words text one character per line. Letting this text
    // shrink and wrap too (min-w-0 + break-words) shares the squeeze
    // between both siblings instead.
    return (
      <span className="text-body-md text-on-surface-variant break-words min-w-0">
        Assigned to {clientName(match.assigned_client_id)}
      </span>
    );
  }
  if (match.status === "dismissed") {
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-surface-variant text-on-surface-variant ${className}`}>
        Dismissed
      </span>
    );
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-secondary-container text-on-secondary-container ${className}`}>
      New
    </span>
  );
}

function AssignControls({
  match,
  clients,
  selected,
  onSelect,
  onAssign,
  onDismiss,
  busy,
  stacked = false,
}: {
  match: Match;
  clients: Client[];
  selected: string;
  onSelect: (value: string) => void;
  onAssign: () => void;
  onDismiss: () => void;
  busy: boolean;
  stacked?: boolean;
}) {
  return (
    <div className={`flex ${stacked ? "flex-col" : "items-center"} gap-2 min-w-0`}>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        // A <select> sizes itself to its longest option by default, ignoring
        // a flex/table-cell parent's width — a long client name here (e.g.
        // "River City Janitorial Partners LLC") was blowing the whole row
        // past the table's own 100% width. min-w-0 lets it actually shrink;
        // the fixed max-w keeps it from doing this again with more clients.
        className={`px-2 py-1.5 rounded border border-outline-variant bg-surface text-body-sm text-on-surface min-w-0 ${
          stacked ? "w-full" : "w-32 max-w-[9rem] shrink"
        }`}
      >
        <option value="">Assign to…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.company_name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onAssign}
          disabled={busy}
          className="px-3 py-1.5 rounded bg-secondary text-on-secondary text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
        >
          {busy && <Spinner />}
          Assign
        </button>
        <button
          onClick={onDismiss}
          disabled={busy}
          className="px-3 py-1.5 rounded border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
