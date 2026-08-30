"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

type Match = {
  id: string;
  source_title: string;
  source_agency: string;
  source_url: string | null;
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
  const [error, setError] = useState<string | null>(null);

  const [logging, setLogging] = useState(false);
  const [title, setTitle] = useState("");
  const [agency, setAgency] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [matchScore, setMatchScore] = useState("");

  const supabase = createClient();

  function clientName(clientId: string | null) {
    return clients.find((c) => c.id === clientId)?.company_name ?? "—";
  }

  async function handleLogOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !agency.trim()) return;
    setLogging(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("matched_opportunities")
      .insert({
        org_id: orgId,
        source_title: title,
        source_agency: agency,
        due_date: dueDate || null,
        match_score: matchScore ? Number(matchScore) : null,
        status: "new",
      })
      .select()
      .single();

    setLogging(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't log that opportunity.");
      return;
    }

    setMatches((m) => [data, ...m]);
    setTitle("");
    setAgency("");
    setDueDate("");
    setMatchScore("");
  }

  async function handleAssign(matchId: string) {
    const clientId = assignSelections[matchId];
    if (!clientId) {
      setError("Pick a client to assign this to first.");
      return;
    }

    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    setBusyId(matchId);
    setError(null);

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        client_id: clientId,
        agency: match.source_agency,
        scope: `From matched opportunity: ${match.source_title}`,
        due_date: match.due_date,
        stage: "submitted",
        draft: false,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      setError(submissionError?.message ?? "Couldn't create a submission for this client.");
      setBusyId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ assigned_client_id: clientId, status: "assigned" })
      .eq("id", matchId);

    if (updateError) {
      setError(updateError.message);
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

    setMatches((m) =>
      m.map((x) => (x.id === matchId ? { ...x, status: "assigned", assigned_client_id: clientId } : x))
    );
    setBusyId(null);
  }

  async function handleDismiss(matchId: string) {
    setBusyId(matchId);
    setError(null);

    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ status: "dismissed" })
      .eq("id", matchId);

    if (updateError) {
      setError(updateError.message);
      setBusyId(null);
      return;
    }

    setMatches((m) => m.map((x) => (x.id === matchId ? { ...x, status: "dismissed" } : x)));
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-6 mt-4">
      {error && <p className="text-body-md text-error">{error}</p>}

      <form
        onSubmit={handleLogOpportunity}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col md:flex-row gap-3 items-end flex-wrap"
      >
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
        <div>
          <label className="text-label-md text-on-surface-variant block mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
          />
        </div>
        <div className="w-28">
          <label className="text-label-md text-on-surface-variant block mb-1">Match score</label>
          <input
            type="number"
            min={0}
            max={100}
            value={matchScore}
            onChange={(e) => setMatchScore(e.target.value)}
            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={logging}
          className="py-2 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
        >
          {logging && <Spinner />}
          {logging ? "Logging…" : "Log opportunity"}
        </button>
      </form>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-body-md">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Title</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Agency</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Due</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Score</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Status</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant"></th>
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
                <td className="px-4 py-3 text-on-surface font-semibold">
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
                <td className="px-4 py-3 text-on-surface-variant">{m.source_agency}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {m.due_date ? new Date(m.due_date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{m.match_score ?? "—"}</td>
                <td className="px-4 py-3">
                  {m.status === "assigned" ? (
                    <span className="text-body-md text-on-surface-variant">
                      Assigned to {clientName(m.assigned_client_id)}
                    </span>
                  ) : m.status === "dismissed" ? (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-surface-variant text-on-surface-variant">
                      Dismissed
                    </span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-secondary-container text-on-secondary-container">
                      New
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.status === "new" && (
                    <div className="flex items-center gap-2">
                      <select
                        value={assignSelections[m.id] ?? ""}
                        onChange={(e) => setAssignSelections((s) => ({ ...s, [m.id]: e.target.value }))}
                        className="px-2 py-1.5 rounded border border-outline-variant bg-surface text-body-sm text-on-surface"
                      >
                        <option value="">Assign to…</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(m.id)}
                        disabled={busyId === m.id}
                        className="px-3 py-1.5 rounded bg-secondary text-on-secondary text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
                      >
                        {busyId === m.id && <Spinner />}
                        Assign
                      </button>
                      <button
                        onClick={() => handleDismiss(m.id)}
                        disabled={busyId === m.id}
                        className="px-3 py-1.5 rounded border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
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
    </div>
  );
}
