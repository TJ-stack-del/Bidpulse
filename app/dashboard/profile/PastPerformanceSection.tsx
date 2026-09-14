"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { uploadAndInsertRecord, removeRfpDocument } from "@/lib/storage";

type VerificationStatus = "self_reported" | "confirmed_federal_award" | "unconfirmed";

type PastPerformance = {
  id: string;
  reference_client_name: string;
  scope_of_work: string;
  contract_value: string | null;
  outcome: string | null;
  created_at: string;
  photo_url: string | null;
  photo_file_name: string | null;
  prime_gc_name: string | null;
  on_time_percentage: number | null;
  verification_status: VerificationStatus;
};

const inputClass =
  "px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

// Real place for the two capability-statement "Past Performance" bracket
// rows generate-draft/route.ts otherwise always leaves unfilled — see that
// route's own comment on why. Self-reported by default, same as
// Differentiators on this same page -- NOT an official credential the way
// a certification file is, so no admin verify gate. The one exception:
// "Check federal records" runs a real check against USASpending.gov's
// public API (via /api/verify-past-performance) and only ever upgrades
// the status to "confirmed_federal_award" on an actual match -- a clean
// no-match (the common case for local/school-district work) leaves it
// self-reported, never shown as a red flag.
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
  const [primeGcName, setPrimeGcName] = useState("");
  const [onTimePercentage, setOnTimePercentage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const supabase = createClient();
  const idPrefix = useId();

  function resetForm() {
    setReferenceClientName("");
    setScopeOfWork("");
    setContractValue("");
    setOutcome("");
    setPrimeGcName("");
    setOnTimePercentage("");
    setPhoto(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!referenceClientName.trim() || !scopeOfWork.trim()) {
      setError("Client name and scope of work are required.");
      return;
    }
    const onTimeValue = onTimePercentage.trim() ? Number(onTimePercentage) : null;
    if (onTimeValue != null && (Number.isNaN(onTimeValue) || onTimeValue < 0 || onTimeValue > 100)) {
      setError("On-time % must be a number from 0 to 100.");
      return;
    }

    setSubmitting(true);

    const result = await uploadAndInsertRecord<PastPerformance>(supabase, {
      path: photo ? `${clientId}/past-performance/${Date.now()}-${photo.name}` : "",
      file: photo,
      table: "client_past_performance",
      fileUrlColumn: "photo_url",
      fileNameColumn: "photo_file_name",
      payload: {
        client_id: clientId,
        reference_client_name: referenceClientName.trim(),
        scope_of_work: scopeOfWork.trim(),
        contract_value: contractValue.trim() || null,
        outcome: outcome.trim() || null,
        prime_gc_name: primeGcName.trim() || null,
        on_time_percentage: onTimeValue,
      },
    });

    if (result.error) {
      setError(result.error === "Couldn't save the record." ? "Couldn't save that." : result.error);
      setSubmitting(false);
      return;
    }

    setEntries((e) => [{ ...result.row, photo_url: result.signedUrl }, ...e]);
    resetForm();
    setSubmitting(false);
  }

  // photo_url in local state is always a signed URL -- re-reads the real
  // storage path from the DB rather than trying to derive it from that.
  async function handleRemove(id: string) {
    const { data: row } = await supabase.from("client_past_performance").select("photo_url").eq("id", id).single();
    await supabase.from("client_past_performance").delete().eq("id", id);
    await removeRfpDocument(supabase, row?.photo_url ?? null);
    setEntries((e) => e.filter((entry) => entry.id !== id));
  }

  async function handleCheckFederal(id: string) {
    setCheckingId(id);
    try {
      const res = await fetch("/api/verify-past-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status) {
        setEntries((e) => e.map((entry) => (entry.id === id ? { ...entry, verification_status: data.status } : entry)));
      }
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAdd}
        className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap"
      >
        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${idPrefix}-ref-name`} className="text-label-md text-on-surface-variant block mb-1">Client / agency name</label>
          <input
            id={`${idPrefix}-ref-name`}
            value={referenceClientName}
            onChange={(e) => setReferenceClientName(e.target.value)}
            placeholder="e.g. City of Round Rock"
            className={`w-full ${inputClass}`}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label htmlFor={`${idPrefix}-scope`} className="text-label-md text-on-surface-variant block mb-1">Scope of work</label>
          <input
            id={`${idPrefix}-scope`}
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            placeholder="e.g. HVAC preventive maintenance, 3 buildings"
            className={`w-full ${inputClass}`}
          />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-value`} className="text-label-md text-on-surface-variant block mb-1">Contract value (optional)</label>
          <input
            id={`${idPrefix}-value`}
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
            placeholder="e.g. $185,000"
            className={inputClass}
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${idPrefix}-outcome`} className="text-label-md text-on-surface-variant block mb-1">Outcome (optional)</label>
          <input
            id={`${idPrefix}-outcome`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Completed on time, renewed 2 years"
            className={`w-full ${inputClass}`}
          />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-prime-gc`} className="text-label-md text-on-surface-variant block mb-1">Prime GC (optional)</label>
          <input
            id={`${idPrefix}-prime-gc`}
            value={primeGcName}
            onChange={(e) => setPrimeGcName(e.target.value)}
            placeholder="e.g. Turner Construction"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-on-time`} className="text-label-md text-on-surface-variant block mb-1">On-time % (optional)</label>
          <input
            id={`${idPrefix}-on-time`}
            type="number"
            min={0}
            max={100}
            value={onTimePercentage}
            onChange={(e) => setOnTimePercentage(e.target.value)}
            placeholder="e.g. 100"
            className={`${inputClass} w-24`}
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${idPrefix}-photo`} className="text-label-md text-on-surface-variant block mb-1">Project photo (optional)</label>
          <label htmlFor={`${idPrefix}-photo`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            {photo ? photo.name : "Choose photo"}
            <input id={`${idPrefix}-photo`} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              <div className="flex items-center gap-3">
                {entry.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- a private, signed storage URL, not an optimizable static asset
                  <img src={entry.photo_url} alt="" className="w-14 h-14 rounded object-cover border border-outline-variant" />
                )}
                <div>
                  <p className="text-body-md text-on-surface font-bold flex items-center gap-2">
                    {entry.reference_client_name}
                    {entry.contract_value ? ` · ${entry.contract_value}` : ""}
                    {entry.verification_status === "confirmed_federal_award" && (
                      <span className="text-[10px] px-2 py-0.5 rounded border font-bold uppercase bg-secondary-container text-on-secondary-container border-primary/20">
                        Confirmed via USASpending.gov
                      </span>
                    )}
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    {entry.scope_of_work}
                    {entry.outcome ? ` · ${entry.outcome}` : ""}
                    {entry.prime_gc_name ? ` · Prime: ${entry.prime_gc_name}` : ""}
                    {entry.on_time_percentage != null ? ` · ${entry.on_time_percentage}% on-time` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {entry.verification_status !== "confirmed_federal_award" && (
                  <button
                    type="button"
                    onClick={() => handleCheckFederal(entry.id)}
                    disabled={checkingId === entry.id}
                    className="text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm disabled:opacity-40 flex items-center gap-2"
                  >
                    {checkingId === entry.id && <Spinner />}
                    Check federal records
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  className="text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error rounded-sm"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
