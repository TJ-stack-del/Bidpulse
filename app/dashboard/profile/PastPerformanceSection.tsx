"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

type PastPerformance = {
  id: string;
  reference_client_name: string;
  scope_of_work: string;
  contract_value: string | null;
  outcome: string | null;
  created_at: string;
};

// Real place for the two capability-statement "Past Performance" bracket
// rows generate-draft/route.ts otherwise always leaves unfilled — see that
// route's own comment on why. Self-reported and used as-is, no admin
// verification step, same as Differentiators below on this same page (not
// treated as an official credential the way a certification file is).
export function PastPerformanceSection({
  clientId,
  initialEntries,
}: {
  clientId: string;
  initialEntries: PastPerformance[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [referenceClientName, setReferenceClientName] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [outcome, setOutcome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function resetForm() {
    setReferenceClientName("");
    setScopeOfWork("");
    setContractValue("");
    setOutcome("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!referenceClientName.trim() || !scopeOfWork.trim()) {
      setError("Client name and scope of work are required.");
      return;
    }

    setSubmitting(true);

    const { data: newEntry, error: insertError } = await supabase
      .from("client_past_performance")
      .insert({
        client_id: clientId,
        reference_client_name: referenceClientName.trim(),
        scope_of_work: scopeOfWork.trim(),
        contract_value: contractValue.trim() || null,
        outcome: outcome.trim() || null,
      })
      .select()
      .single();

    if (insertError || !newEntry) {
      setError(insertError?.message ?? "Couldn't save that.");
      setSubmitting(false);
      return;
    }

    setEntries((e) => [newEntry, ...e]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    await supabase.from("client_past_performance").delete().eq("id", id);
    setEntries((e) => e.filter((entry) => entry.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAdd}
        className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="text-label-md text-on-surface-variant block mb-1">Client / agency name</label>
          <input
            value={referenceClientName}
            onChange={(e) => setReferenceClientName(e.target.value)}
            placeholder="e.g. City of Round Rock"
            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary outline-none"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-label-md text-on-surface-variant block mb-1">Scope of work</label>
          <input
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            placeholder="e.g. HVAC preventive maintenance, 3 buildings"
            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="text-label-md text-on-surface-variant block mb-1">Contract value (optional)</label>
          <input
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
            placeholder="e.g. $185,000"
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary outline-none"
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="text-label-md text-on-surface-variant block mb-1">Outcome (optional)</label>
          <input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Completed on time, renewed 2 years"
            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
        >
          {submitting && <Spinner />}
          {submitting ? "Adding…" : "Add project"}
        </button>
      </form>

      {error && <p className="text-body-md text-error">{error}</p>}

      {entries.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No past projects added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap"
            >
              <div>
                <p className="text-body-md text-on-surface font-bold">
                  {entry.reference_client_name}
                  {entry.contract_value ? ` — ${entry.contract_value}` : ""}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {entry.scope_of_work}
                  {entry.outcome ? ` · ${entry.outcome}` : ""}
                </p>
              </div>
              <button onClick={() => handleRemove(entry.id)} className="text-error text-label-md hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
