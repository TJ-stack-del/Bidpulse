"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { signRfpDocumentUrl, uploadRfpDocument } from "@/lib/storage";
import { CERT_REVIEWED_TOOLTIP } from "@/lib/brand";

type InsurancePolicy = {
  id: string;
  policy_type: string;
  carrier_name: string | null;
  policy_number: string | null;
  per_occurrence_limit: string | null;
  aggregate_limit: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
};

type BondingRecord = {
  id: string;
  surety_name: string | null;
  bond_number: string | null;
  aggregate_bonding_capacity: string | null;
  single_project_bonding_capacity: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
};

const POLICY_TYPES: { value: string; label: string }[] = [
  { value: "general_liability", label: "General Liability" },
  { value: "workers_comp", label: "Workers' Comp" },
  { value: "commercial_auto", label: "Commercial Auto" },
  { value: "professional_liability", label: "Professional Liability" },
  { value: "umbrella", label: "Umbrella" },
];

const inputClass =
  "px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

// Two independent tables (client_insurance_policies, client_bonding_capacity)
// behind one "kind" toggle in a single form -- a COI and a bond letter
// carry genuinely different fields, but the upload/verify mechanics are
// identical, same as CertificationsSection.tsx's own upload pattern.
export function InsuranceBondingSection({
  clientId,
  initialPolicies,
  initialBonding,
}: {
  clientId: string;
  initialPolicies: InsurancePolicy[];
  initialBonding: BondingRecord[];
}) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [bonding, setBonding] = useState(initialBonding);
  const [kind, setKind] = useState<"insurance" | "bonding">("insurance");

  const [policyType, setPolicyType] = useState(POLICY_TYPES[0].value);
  const [carrierName, setCarrierName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [perOccurrenceLimit, setPerOccurrenceLimit] = useState("");
  const [aggregateLimit, setAggregateLimit] = useState("");

  const [suretyName, setSuretyName] = useState("");
  const [bondNumber, setBondNumber] = useState("");
  const [aggregateCapacity, setAggregateCapacity] = useState("");
  const [singleProjectCapacity, setSingleProjectCapacity] = useState("");
  const [obligee, setObligee] = useState("");

  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function resetForm() {
    setCarrierName("");
    setPolicyNumber("");
    setPerOccurrenceLimit("");
    setAggregateLimit("");
    setSuretyName("");
    setBondNumber("");
    setAggregateCapacity("");
    setSingleProjectCapacity("");
    setObligee("");
    setEffectiveDate("");
    setExpirationDate("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Document optional at save time -- only becomes required at the point
    // an admin marks it verified (AdminInsuranceBonding.tsx's toggle, backed
    // by the same CHECK constraint client_certifications already proved).
    let path: string | null = null;
    if (file) {
      const uploaded = await uploadRfpDocument(
        supabase,
        `${clientId}/${kind === "insurance" ? "insurance" : "bonding"}/${Date.now()}-${file.name}`,
        file
      );
      if (uploaded.error) {
        setError(uploaded.error);
        setSubmitting(false);
        return;
      }
      path = uploaded.path;
    }

    if (kind === "insurance") {
      const { data: newRow, error: insertError } = await supabase
        .from("client_insurance_policies")
        .insert({
          client_id: clientId,
          policy_type: policyType,
          carrier_name: carrierName.trim() || null,
          policy_number: policyNumber.trim() || null,
          per_occurrence_limit: perOccurrenceLimit.trim() || null,
          aggregate_limit: aggregateLimit.trim() || null,
          effective_date: effectiveDate || null,
          expiration_date: expirationDate || null,
          file_url: path,
          file_name: file ? file.name : null,
        })
        .select()
        .single();

      if (insertError || !newRow) {
        setError(insertError?.message ?? "Couldn't record the policy.");
        setSubmitting(false);
        return;
      }
      const signedUrl = path ? await signRfpDocumentUrl(supabase, path) : null;
      setPolicies((p) => [{ ...newRow, file_url: signedUrl }, ...p]);
    } else {
      const { data: newRow, error: insertError } = await supabase
        .from("client_bonding_capacity")
        .insert({
          client_id: clientId,
          surety_name: suretyName.trim() || null,
          bond_number: bondNumber.trim() || null,
          aggregate_bonding_capacity: aggregateCapacity.trim() || null,
          single_project_bonding_capacity: singleProjectCapacity.trim() || null,
          obligee: obligee.trim() || null,
          effective_date: effectiveDate || null,
          expiration_date: expirationDate || null,
          file_url: path,
          file_name: file ? file.name : null,
        })
        .select()
        .single();

      if (insertError || !newRow) {
        setError(insertError?.message ?? "Couldn't record the bonding capacity.");
        setSubmitting(false);
        return;
      }
      const signedUrl = path ? await signRfpDocumentUrl(supabase, path) : null;
      setBonding((b) => [{ ...newRow, file_url: signedUrl }, ...b]);
    }

    resetForm();
    setSubmitting(false);
  }

  async function handleRemovePolicy(id: string) {
    await supabase.from("client_insurance_policies").delete().eq("id", id);
    setPolicies((p) => p.filter((row) => row.id !== id));
  }
  async function handleRemoveBonding(id: string) {
    await supabase.from("client_bonding_capacity").delete().eq("id", id);
    setBonding((b) => b.filter((row) => row.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap">
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as "insurance" | "bonding")} className={inputClass}>
              <option value="insurance">Insurance policy</option>
              <option value="bonding">Bonding capacity</option>
            </select>
          </div>

          {kind === "insurance" ? (
            <>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Policy type</label>
                <select value={policyType} onChange={(e) => setPolicyType(e.target.value)} className={inputClass}>
                  {POLICY_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Carrier</label>
                <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Policy # (optional)</label>
                <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Per-occurrence limit</label>
                <input value={perOccurrenceLimit} onChange={(e) => setPerOccurrenceLimit(e.target.value)} placeholder="e.g. $1,000,000" className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Aggregate limit</label>
                <input value={aggregateLimit} onChange={(e) => setAggregateLimit(e.target.value)} placeholder="e.g. $2,000,000" className={inputClass} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Surety</label>
                <input value={suretyName} onChange={(e) => setSuretyName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Bond # (optional)</label>
                <input value={bondNumber} onChange={(e) => setBondNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Single-project capacity</label>
                <input value={singleProjectCapacity} onChange={(e) => setSingleProjectCapacity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Aggregate capacity</label>
                <input value={aggregateCapacity} onChange={(e) => setAggregateCapacity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-label-md text-on-surface-variant block mb-1">Obligee (optional)</label>
                <input value={obligee} onChange={(e) => setObligee(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Expires (optional)</label>
            <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className={inputClass} />
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="text-label-md text-on-surface-variant block mb-1">Document (optional)</label>
            <label className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              {file ? file.name : "Choose file"}
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {submitting && <Spinner />}
            {submitting ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      {error && <p className="text-body-md text-error">{error}</p>}

      <div>
        <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Insurance policies</h3>
        {policies.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No insurance policies added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {policies.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
                <div>
                  <p className="text-body-md text-on-surface font-bold">
                    {POLICY_TYPES.find((pt) => pt.value === p.policy_type)?.label ?? p.policy_type}
                    {p.carrier_name ? ` — ${p.carrier_name}` : ""}
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    {p.expiration_date ? `Expires ${new Date(p.expiration_date).toLocaleDateString()}` : "No expiration on file"}
                    {p.file_url && (
                      <>
                        {" · "}
                        <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                          {p.file_name ?? "View document"}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    title={p.verified ? CERT_REVIEWED_TOOLTIP : undefined}
                    className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                      p.verified ? "bg-secondary-container text-on-secondary-container border-primary/20" : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                    }`}
                  >
                    {p.verified ? "Document Reviewed" : "Not yet reviewed"}
                  </span>
                  <button type="button" onClick={() => handleRemovePolicy(p.id)} className="text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error rounded-sm">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Bonding capacity</h3>
        {bonding.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No bonding capacity added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bonding.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
                <div>
                  <p className="text-body-md text-on-surface font-bold">
                    {b.surety_name ?? "Surety bond"}
                    {b.bond_number ? ` (#${b.bond_number})` : ""}
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    {b.expiration_date ? `Expires ${new Date(b.expiration_date).toLocaleDateString()}` : "No expiration on file"}
                    {b.file_url && (
                      <>
                        {" · "}
                        <a href={b.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                          {b.file_name ?? "View document"}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    title={b.verified ? CERT_REVIEWED_TOOLTIP : undefined}
                    className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                      b.verified ? "bg-secondary-container text-on-secondary-container border-primary/20" : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                    }`}
                  >
                    {b.verified ? "Document Reviewed" : "Not yet reviewed"}
                  </span>
                  <button type="button" onClick={() => handleRemoveBonding(b.id)} className="text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error rounded-sm">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
