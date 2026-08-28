"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type FormState = {
  // About you
  companyName: string;
  contactName: string;
  email: string;
  password: string;
  phone: string;
  naicsCodes: string;
  smallBusinessStatuses: string;
  setAsides: string;
  // About the bid
  agency: string;
  solicitationNumber: string;
  dueDate: string;
  scope: string;
};

const STEPS = ["About you", "About the bid", "Your bid file"];

export function IntakeWizard() {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    companyName: "",
    contactName: "",
    email: "",
    password: "",
    phone: "",
    naicsCodes: "",
    smallBusinessStatuses: "",
    setAsides: "",
    agency: "",
    solicitationNumber: "",
    dueDate: "",
    scope: "",
  });
  const supabase = createClient();

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  // Step 1 -> 2: creates the account + client record (this is the moment
  // a brand-new visitor becomes a real, logged-in client).
  async function handleAboutYouNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? "Couldn't create your account.");
      setSaving(false);
      return;
    }

    // First org in the system becomes "the" org for now — single-tenant
    // service business. In a real multi-admin setup this would look up
    // the right org differently; fine as a starting assumption here.
    const { data: org } = await supabase.from("organizations").select("id").limit(1).single();

    if (!org) {
      setError("No admin organization set up yet. Contact support.");
      setSaving(false);
      return;
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        org_id: org.id,
        auth_user_id: signUpData.user.id,
        company_name: form.companyName,
        contact_name: form.contactName,
        email: form.email,
        phone: form.phone,
        naics_codes: form.naicsCodes.split(",").map((s) => s.trim()).filter(Boolean),
        small_business_statuses: form.smallBusinessStatuses
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        set_asides: form.setAsides.split(",").map((s) => s.trim()).filter(Boolean),
      })
      .select()
      .single();

    setSaving(false);

    if (clientError || !client) {
      setError(clientError?.message ?? "Couldn't save your info.");
      return;
    }

    setClientId(client.id);
    setStep(1);
  }

  // Step 2 -> 3: creates the draft submission.
  async function handleAboutBidNext(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError(null);

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        client_id: clientId,
        agency: form.agency,
        solicitation_number: form.solicitationNumber || null,
        due_date: form.dueDate || null,
        scope: form.scope,
        draft: true,
      })
      .select()
      .single();

    setSaving(false);

    if (subError || !submission) {
      setError(subError?.message ?? "Couldn't save the bid details.");
      return;
    }

    setSubmissionId(submission.id);
    setStep(2);
  }

  async function handleSaveDraft() {
    if (!submissionId) return;
    setSaving(true);
    await supabase
      .from("submissions")
      .update({ draft_saved_at: new Date().toISOString() })
      .eq("id", submissionId);
    setSaving(false);
    setSaved(true);
  }

  async function handleFinalSubmit() {
    if (!submissionId || !clientId) return;
    setSaving(true);
    setError(null);

    const { error: submitError } = await supabase
      .from("submissions")
      .update({
        draft: false,
        submitted_at: new Date().toISOString(),
        stage: "submitted",
      })
      .eq("id", submissionId);

    if (submitError) {
      setError(submitError.message);
      setSaving(false);
      return;
    }

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: (await supabase.from("clients").select("org_id").eq("id", clientId).single()).data
        ?.org_id,
      event_type: "submission_locked",
      event_detail: { event: "client_submitted" },
    });

    setSaving(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
        <h1 className="text-headline-md text-on-surface mb-2">We've got it.</h1>
        <p className="text-body-lg text-on-surface-variant">
          Thanks — we'll review your bid and be in touch. You can check on
          progress any time by logging in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded ${i <= step ? "bg-secondary" : "bg-outline-variant"}`}
            />
            <p
              className={`text-label-md mt-1 ${
                i === step ? "text-secondary font-bold" : "text-on-surface-variant"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      {step === 0 && (
        <form onSubmit={handleAboutYouNext} className="flex flex-col gap-4">
          <h2 className="text-headline-md text-on-surface">About you</h2>
          <Input label="Company name" value={form.companyName} onChange={(v) => update("companyName", v)} required />
          <Input label="Your name" value={form.contactName} onChange={(v) => update("contactName", v)} required />
          <Input label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <Input label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} required />
          <Input label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
          <Input
            label="NAICS codes (comma separated, if you know them)"
            value={form.naicsCodes}
            onChange={(v) => update("naicsCodes", v)}
          />
          <Input
            label="Small business status (comma separated, e.g. WOSB, SDVOSB)"
            value={form.smallBusinessStatuses}
            onChange={(v) => update("smallBusinessStatuses", v)}
          />
          <Input
            label="Set-asides that apply (comma separated)"
            value={form.setAsides}
            onChange={(v) => update("setAsides", v)}
          />
          <button
            type="submit"
            disabled={saving}
            className="py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Next"}
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handleAboutBidNext} className="flex flex-col gap-4">
          <h2 className="text-headline-md text-on-surface">About the bid</h2>
          <Input label="Agency" value={form.agency} onChange={(v) => update("agency", v)} required />
          <Input
            label="Solicitation number"
            value={form.solicitationNumber}
            onChange={(v) => update("solicitationNumber", v)}
          />
          <Input label="Due date" type="date" value={form.dueDate} onChange={(v) => update("dueDate", v)} />
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">
              What does the job involve?
            </label>
            <textarea
              value={form.scope}
              onChange={(e) => update("scope", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Next"}
          </button>
        </form>
      )}

      {step === 2 && submissionId && (
        <div className="flex flex-col gap-4">
          <h2 className="text-headline-md text-on-surface">Your bid file</h2>
          <p className="text-body-md text-on-surface-variant">
            Upload the RFP file from the agency, if you have it. You can also
            add this later.
          </p>
          {/* File upload wiring goes here once SubmissionDocuments component
              is built — see BUILD-ORDER-SPECWRIGHT.md step 4 */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex-1 py-3 px-4 bg-surface border border-outline-variant rounded text-label-md hover:bg-surface-container-high transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save & finish later"}
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={saving}
              className="flex-1 py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40"
            >
              {saving ? "Sending…" : "Send it to us"}
            </button>
          </div>
          {saved && <p className="text-body-md text-secondary">Saved — you can come back anytime.</p>}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-label-md text-on-surface-variant block mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
      />
    </div>
  );
}
