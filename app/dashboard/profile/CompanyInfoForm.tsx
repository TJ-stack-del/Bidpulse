"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";

type CompanyInfo = {
  license_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
  differentiators: string | null;
};

const FIELDS: { key: keyof CompanyInfo; label: string; type?: string; area?: boolean }[] = [
  { key: "license_number", label: "License number" },
  { key: "years_in_business", label: "Years in business", type: "number" },
  { key: "business_address", label: "Business address" },
  { key: "business_phone", label: "Business phone" },
  { key: "insurance_provider", label: "Insurance provider" },
  { key: "insurance_policy_number", label: "Insurance policy number" },
  { key: "general_liability_coverage", label: "General liability coverage (e.g. $1M/$2M)" },
  { key: "workers_comp_coverage", label: "Workers' comp coverage" },
];

// Filled in once, reused as facts across every future bid (app/api/
// generate-draft, app/api/generate-fit-check) instead of re-asking the
// client the same questions on every submission.
export function CompanyInfoForm({
  clientId,
  initialInfo,
}: {
  clientId: string;
  initialInfo: CompanyInfo;
}) {
  const [values, setValues] = useState<CompanyInfo>(initialInfo);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function setField(key: keyof CompanyInfo, value: string) {
    setValues((v) => ({
      ...v,
      [key]: key === "years_in_business" ? (value === "" ? null : Number(value)) : value === "" ? null : value,
    }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase.from("clients").update(values).eq("id", clientId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-label-md text-on-surface-variant block mb-1">{f.label}</label>
            <input
              type={f.type ?? "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-label-md text-on-surface-variant block mb-1">
          Differentiators / notable past projects
        </label>
        <textarea
          value={values.differentiators ?? ""}
          onChange={(e) => setField("differentiators", e.target.value)}
          rows={4}
          placeholder="What sets your company apart — track record, capacity, notable prior contracts…"
          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="py-2 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 w-fit"
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save company info"}
        </button>
        <FadeMessage show={saved} className="text-body-md text-secondary">
          Saved
        </FadeMessage>
      </div>
      {error && <p className="text-body-md text-error">{error}</p>}
    </form>
  );
}
