"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { BidFileStep } from "@/components/ui/BidFileStep";
import { isEmail, normalizePhone } from "@/lib/phone";

// NAICS codes, small business status, and set-asides used to be collected
// here too — moved to Company Profile (app/dashboard/profile) instead, so a
// brand-new visitor (often mid-job, on a phone) only has to answer what's
// needed to start a bid. They can fill the rest in later when there's time.
type FormState = {
  // About you
  companyName: string;
  contactName: string;
  contact: string; // email or phone — whichever the client prefers to use
  password: string;
  // About the bid
  agency: string;
  solicitationNumber: string;
  dueDate: string;
  scope: string;
};

const STEPS = ["About you", "About the bid", "Your bid file"];

// Small backoff retry for the two RLS-gated calls right after signup — org
// lookup and the client insert. Not a fix for a session race (signUp()
// already awaits saving its session into this client instance before it
// resolves, and getUser() below re-confirms that server-side), but real
// production traffic can still hit a transient blip — a cold-started
// connection pool, a dropped response — in the seconds right after a brand
// new account is created, and a single unguarded attempt turned that into a
// permanently missing clients row with only a vague error to show for it.
async function withRetry<T>(
  run: () => Promise<{ data: T | null; error: { message: string } | null }>,
  attempts = 3
): Promise<{ data: T | null; error: { message: string } | null }> {
  let last: { data: T | null; error: { message: string } | null } = { data: null, error: null };
  for (let i = 0; i < attempts; i++) {
    last = await run();
    if (last.data) return last;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
  }
  return last;
}

// Framed as readiness for OUR prep process, never as odds of winning —
// "Worth a second look" reads as neutral/informative, not a rejection.
const FIT_LABELS: Record<string, string> = {
  strong: "Strong fit",
  moderate: "Moderate fit",
  weak: "Worth a second look",
};
const FIT_STYLE: Record<string, string> = {
  strong: "bg-secondary-container text-on-secondary-container",
  moderate: "bg-surface-container-highest text-on-surface-variant",
  weak: "bg-surface-container-highest text-on-surface-variant",
};

export function IntakeWizard() {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [fitCheck, setFitCheck] = useState<{ alignment: string; explanation: string } | null>(null);
  const [fitCheckLoading, setFitCheckLoading] = useState(false);
  // Blocks rendering step 0 until this resolves — without it, a client who's
  // already logged in (e.g. starting a second bid) would briefly see the
  // signup form and could submit it, calling signUp() a second time for an
  // account that already exists ("User already registered"), which blocked
  // them from ever reaching "About the bid." An existing client with a
  // clients row skips step 0 entirely and starts on "About the bid" instead.
  const [checkingSession, setCheckingSession] = useState(true);
  const [form, setForm] = useState<FormState>({
    companyName: "",
    contactName: "",
    contact: "",
    password: "",
    agency: "",
    solicitationNumber: "",
    dueDate: "",
    scope: "",
  });
  const supabase = createClient();

  // A client who's already logged in (starting a second bid, or just
  // returned to this page) already has an account and a clients row — step
  // 0 exists only to create both for a brand-new visitor, so it must never
  // run for them. Skip straight to "About the bid" instead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (client) {
        setClientId(client.id);
        setStep(1);
      }
      setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Step 1 -> 2: creates the account + client record (this is the moment
  // a brand-new visitor becomes a real, logged-in client). Guarded against
  // ever running for an already-authenticated visitor by the session check
  // above (it skips step 0 entirely for them) — but this also double-checks
  // for a session itself before ever calling signUp(), since a second
  // signUp() for an existing account fails with "User already registered."
  async function handleAboutYouNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    let user = existingUser;

    if (!user) {
      const contact = form.contact.trim();
      const usingEmail = isEmail(contact);

      const { data: signUpData, error: signUpError } = usingEmail
        ? await supabase.auth.signUp({ email: contact, password: form.password })
        : await supabase.auth.signUp({ phone: normalizePhone(contact), password: form.password });

      if (signUpError || !signUpData.user) {
        setError(signUpError?.message ?? "Couldn't create your account.");
        setSaving(false);
        return;
      }

      // No session yet means the project requires confirming this contact
      // method before the account is usable (a code/link was just sent) — a
      // phone signup in particular almost always lands here. Without a
      // session, auth.uid() is null and the clients insert right below would
      // just fail RLS, so this has to stop here instead of pushing forward.
      if (!signUpData.session) {
        setError(
          usingEmail
            ? "Check your email to confirm your account, then come back and sign in to finish."
            : "We texted a code to confirm that number. Phone verification isn't supported in this signup step yet — please use an email instead, or contact us for help."
        );
        setSaving(false);
        return;
      }

      // signUp() already awaited saving this session into the client
      // instance before it resolved, so the access token is already
      // attached to every request below — that only proves it was accepted
      // locally, though, not that Supabase's own API will recognize it as
      // valid yet. getUser() is a real round-trip that asks the server to
      // verify the token (getSession() would just echo local state back),
      // so it's the actual confirmation that the session the inserts below
      // depend on is live, not merely present in memory.
      const {
        data: { user: confirmedUser },
        error: confirmError,
      } = await supabase.auth.getUser();

      if (confirmError || !confirmedUser) {
        setError(
          "Your account was created, but we couldn't confirm your session yet. Please try submitting this step again — you won't need to sign up a second time."
        );
        setSaving(false);
        return;
      }

      user = confirmedUser;
    }

    // First org in the system becomes "the" org for now — single-tenant
    // service business. In a real multi-admin setup this would look up
    // the right org differently; fine as a starting assumption here.
    const { data: org } = await withRetry<{ id: string }>(async () =>
      await supabase.from("organizations").select("id").limit(1).single()
    );

    if (!org) {
      setError("No admin organization set up yet. Contact support.");
      setSaving(false);
      return;
    }

    const contact = form.contact.trim();
    const usingEmail = isEmail(contact);
    const authUserId = user.id;

    // Checks for an existing row before every insert attempt (including
    // retries) rather than inserting blindly — clients.auth_user_id is
    // unique, so a retry after a request whose response got lost (not its
    // insert) would otherwise either 23505 or, worse, double up if the
    // constraint isn't live yet. Re-checking first means the retry always
    // converges on the one real row instead of erroring on its own success.
    const { data: client, error: clientError } = await withRetry<Record<string, unknown>>(async () => {
      const { data: existing } = await supabase.from("clients").select().eq("auth_user_id", authUserId).maybeSingle();
      if (existing) return { data: existing, error: null };

      return await supabase
        .from("clients")
        .insert({
          org_id: org.id,
          auth_user_id: authUserId,
          company_name: form.companyName,
          contact_name: form.contactName,
          email: usingEmail ? contact : null,
          phone: usingEmail ? null : normalizePhone(contact),
        })
        .select()
        .single();
    });

    setSaving(false);

    if (clientError || !client) {
      setError(
        clientError?.message
          ? `Your account was created, but saving your company info failed: ${clientError.message}. Please try this step again.`
          : "Your account was created, but we couldn't save your company info. Please try this step again."
      );
      return;
    }

    setClientId(client.id as string);
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

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="text-secondary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px]">task_alt</span>
        </div>
        <h1 className="text-headline-md text-primary mb-2">We've got it.</h1>
        <p className="text-body-lg text-on-surface-variant">
          Thanks — we'll review your bid and be in touch. You can check on
          progress any time by logging in.
        </p>

        {fitCheckLoading && (
          <p className="text-label-md text-on-surface-variant mt-6 flex items-center justify-center gap-2">
            <Spinner /> Taking a quick look…
          </p>
        )}
        {fitCheck && (
          <div className="mt-6 max-w-md mx-auto bg-surface-container-low border border-outline-variant rounded-xl p-5 text-left">
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-bold ${
                FIT_STYLE[fitCheck.alignment] ?? "bg-surface-container-highest text-on-surface-variant"
              }`}
            >
              {FIT_LABELS[fitCheck.alignment] ?? fitCheck.alignment}
            </span>
            <p className="text-body-md text-on-surface-variant mt-2">{fitCheck.explanation}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Step indicator */}
      <div className="flex items-start justify-between relative">
        <div className="absolute top-3 left-0 w-full h-0.5 bg-outline-variant -z-10" />
        {STEPS.map((label, i) => {
          const isDone = i < step;
          const isActive = i === step;
          return (
            <div key={label} className="flex flex-col items-center gap-2 bg-surface-container-lowest px-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-label-sm font-bold shrink-0 ${
                  isDone
                    ? "bg-secondary text-on-secondary"
                    : isActive
                    ? "border-2 border-secondary bg-surface text-secondary"
                    : "border-2 border-outline-variant bg-surface text-on-surface-variant"
                }`}
              >
                {isDone ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
              </div>
              <span className={`text-label-sm text-center ${isActive ? "text-secondary font-bold" : "text-on-surface-variant"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      {step === 0 && (
        <form onSubmit={handleAboutYouNext} className="flex flex-col gap-4">
          <h2 className="text-headline-md text-primary">Tell us about your business</h2>
          <Input label="Company name" value={form.companyName} onChange={(v) => update("companyName", v)} required />
          <Input label="Your name" value={form.contactName} onChange={(v) => update("contactName", v)} required />
          <div>
            <Input label="Email or phone" value={form.contact} onChange={(v) => update("contact", v)} required />
            <p className="text-label-md text-on-surface-variant mt-1">
              We'll use this to send updates on your bid.
            </p>
          </div>
          <Input label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} required />
          <p className="text-label-md text-on-surface-variant -mt-2">
            NAICS codes, small business status, and set-asides can be added later from your Company Profile.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="py-3 px-4 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Next"}
            {!saving && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handleAboutBidNext} className="flex flex-col gap-4">
          <h2 className="text-headline-md text-primary">Tell us about the job</h2>
          <Input
            label="Who is asking for this? (the agency or department)"
            value={form.agency}
            onChange={(v) => update("agency", v)}
            required
          />
          <div>
            <Input
              label="Bid or RFP number (if you have one)"
              value={form.solicitationNumber}
              onChange={(v) => update("solicitationNumber", v)}
            />
            <p className="text-label-md text-on-surface-variant mt-1">
              This is the number the agency put on the job posting, if there is one.
            </p>
          </div>
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
            className="py-3 px-4 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Next"}
            {!saving && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        </form>
      )}

      {step === 2 && submissionId && (
        <div className="flex flex-col gap-4">
          <h2 className="text-headline-md text-primary">Your bid file</h2>
          <p className="text-body-md text-on-surface-variant">
            Upload the RFP file from the agency, if you have it. You can also
            add this later.
          </p>
          <BidFileStep
            submissionId={submissionId}
            onSubmitted={() => {
              setSubmitted(true);
              setFitCheckLoading(true);
            }}
            onFitCheck={(result) => {
              setFitCheck(result);
              setFitCheckLoading(false);
            }}
          />
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
      <label className="text-label-md text-on-surface-variant uppercase tracking-wide block mb-1">{label}</label>
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
