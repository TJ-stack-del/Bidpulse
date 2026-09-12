"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { BidFileStep } from "@/components/ui/BidFileStep";
import { BidProcessNotices } from "@/components/ui/BidProcessNotices";
import { CompanyProfileUpload, type ExtractedCompanyProfile } from "@/components/ui/CompanyProfileUpload";
import { RfpDocumentUpload, type ExtractedBidFields } from "@/components/ui/RfpDocumentUpload";
import { isEmail, normalizePhone } from "@/lib/phone";
import type { FitCheckResult } from "@/lib/submissions";
import { computeProfileCompleteness } from "@/lib/compliance/profile-completeness";

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

export function IntakeWizard() {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [fitCheck, setFitCheck] = useState<FitCheckResult | null>(null);
  const [fitCheckLoading, setFitCheckLoading] = useState(false);
  // Same deterministic completeness percentage as the dashboard's Status
  // card (lib/compliance/profile-completeness.ts) — replaces the old
  // fit_alignment badge + raw fit_explanation paragraph that used to render
  // here (see BUILD-ORDER-BIDPULSE.md item #7). Fetched client-side once the
  // submission locks, same trigger point as the fit-check fetch above.
  const [completenessPercent, setCompletenessPercent] = useState<number | null>(null);
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
  // Optional micro-step shown right after account creation (see
  // handleProfileExtracted below) — no new required fields added to step 0
  // itself, since it's deliberately kept minimal (see the comment on
  // FormState above).
  const [showProfileUpload, setShowProfileUpload] = useState(false);
  const [profileUploadDone, setProfileUploadDone] = useState(false);
  // Mirrors the "About you" upload micro-step above — an interstitial
  // shown once on arrival at step 1, before "Tell us about the job".
  // Starts true unconditionally (unlike showProfileUpload, this doesn't
  // need to wait on an async account-creation step first) since it's
  // gated on step === 1 in the render below regardless of this value.
  const [showBidUpload, setShowBidUpload] = useState(true);
  const [bidUploadDone, setBidUploadDone] = useState(false);
  const supabase = createClient();

  // A client who's already logged in (starting a second bid, or just
  // returned to this page) already has an account and a clients row — jump
  // straight to "About the bid" instead of making them look at (and
  // possibly fill out) the signup form again. This used to block the
  // wizard's entire first render behind a spinner until this async check
  // resolved, which meant every brand-new anonymous visitor -- the common
  // case -- sat looking at a blank spinner instead of the actual form for
  // however long a real round-trip to Supabase's auth server took, for a
  // check that exists purely for the much rarer "already logged in"
  // visitor. Rendering step 0 immediately and letting this effect swap to
  // step 1 if/when it resolves is safe either way: handleAboutYouNext's own
  // clients insert already re-checks for an existing row first (see its
  // comment below) and reuses it rather than duplicating, so an
  // already-logged-in visitor who somehow submits step 0 before this
  // effect finishes just has their freshly-typed fields ignored in favor
  // of their real record, not corrupted or duplicated.
  //
  // getUser() is a real round-trip to Supabase's auth server (not a local
  // cache read), so on a real user's real network it can transiently fail
  // in a way a same-machine test never reproduces. A single failed attempt
  // here used to be indistinguishable from "not logged in" and would drop
  // an existing client straight onto the signup form for a session that
  // was actually fine. Retry a real error before concluding logged-out —
  // but an error-free "no user"/"no matching clients row" is a genuine,
  // immediate answer and must not be delayed by retrying it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user: { id: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.auth.getUser();
        if (data.user) {
          user = data.user;
          break;
        }
        if (!error) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }

      if (!user) return;

      let client: { id: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("clients")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        client = data;
        if (data || !error) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }

      if (cancelled) return;
      if (client) {
        setClientId(client.id);
        setStep(1);
      }
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
    setShowProfileUpload(true);
  }

  // Optional micro-step shown once right after account creation, before
  // "About the bid" — the extraction route requires a real session, so this
  // can't run any earlier than this point (step 0's own fields are filled by
  // an anonymous visitor). Updates the just-created clients row directly
  // rather than merging into the insert above, and rides certifications
  // along the same way the Company Profile page does. A failure here (or
  // just clicking past it) never blocks reaching "About the bid" — this is
  // a convenience, not a requirement.
  async function handleProfileExtracted(data: ExtractedCompanyProfile, file: File) {
    if (!clientId) return;

    await supabase
      .from("clients")
      .update({
        license_number: data.licenseNumber,
        business_registration_number: data.businessRegistrationNumber,
        years_in_business: data.yearsInBusiness,
        business_address: data.businessAddress,
        business_phone: data.businessPhone,
        insurance_provider: data.insuranceProvider,
        insurance_policy_number: data.insurancePolicyNumber,
        general_liability_coverage: data.generalLiabilityCoverage,
        workers_comp_coverage: data.workersCompCoverage,
        commercial_auto_coverage: data.commercialAutoCoverage,
        naics_codes: data.naicsCodes,
      })
      .eq("id", clientId);

    if (data.certifications.length > 0) {
      const path = `${clientId}/certifications/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("rfp-documents").upload(path, file);
      if (!uploadError) {
        await supabase.from("client_certifications").insert(
          data.certifications.map((c) => ({
            client_id: clientId,
            cert_type: c.certType,
            other_label: c.certType === "Other" ? c.otherLabel : null,
            certification_number: c.certificationNumber,
            expiration_date: c.expirationDate,
            file_url: path,
            file_name: file.name,
          }))
        );
      }
    }

    setProfileUploadDone(true);
  }

  // Prefills the "About the bid" form from an uploaded RFP/solicitation.
  // Only overwrites a field the extraction actually found — same "never
  // invent, leave it for the client to fill in" discipline as every other
  // extraction in this app. The due-date prompt itself (extract-from-
  // document/route.ts) is deliberately conservative: real solicitations
  // often list several other dates (site visit, Q&A deadline, pre-bid
  // conference) that are NOT the submission deadline, so it returns null
  // rather than guessing when it can't clearly tell which date is which —
  // still shown here as a blank field for the client to fill in themselves,
  // never silently defaulted to some other date found in the document.
  function handleBidExtracted(data: ExtractedBidFields) {
    setForm((f) => ({
      ...f,
      agency: data.agency ?? f.agency,
      solicitationNumber: data.solicitationNumber ?? f.solicitationNumber,
      dueDate: data.dueDate ?? f.dueDate,
      scope: data.scope ?? f.scope,
    }));
    setBidUploadDone(true);
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
        {completenessPercent !== null && (
          <div className="mt-6 max-w-md md:max-w-lg mx-auto bg-surface-container-low border border-outline-variant rounded-xl p-5 text-left">
            <span
              className={`inline-flex px-3 py-1 rounded-full text-label-md font-bold ${
                completenessPercent === 100
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-tertiary-container text-on-tertiary-container"
              }`}
            >
              Profile {completenessPercent}% complete
            </span>
            {completenessPercent < 100 && (
              <p className="text-body-md text-on-surface-variant mt-2">
                A more complete Company Profile means less back-and-forth
                before your bid is ready to go out.
              </p>
            )}
          </div>
        )}
        {fitCheck?.mandatorySiteVisitConcern && (
          <div className="mt-4 max-w-md md:max-w-lg mx-auto bg-error-container/20 border border-error/30 rounded-xl p-5 text-left flex gap-3">
            <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
            <div>
              <p className="text-label-md text-error font-bold uppercase tracking-wide mb-1">
                Mandatory site visit — read this
              </p>
              <p className="text-body-md text-on-surface">{fitCheck.mandatorySiteVisitExplanation}</p>
            </div>
          </div>
        )}

        {/* The fit-check note above is actively telling the client to fill
            in their profile — Company Profile is the more prominent action
            here for that reason, not just as a default primary-button choice. */}
        <div className="flex flex-col items-center gap-3 mt-8">
          <Link
            href="/dashboard/profile"
            className="py-3 px-6 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 transition active:scale-[0.97]"
          >
            Complete your Company Profile
          </Link>
          <Link
            href="/dashboard"
            className="py-3 px-6 border border-outline-variant text-on-surface rounded text-label-md hover:bg-surface-container-high transition active:scale-[0.97]"
          >
            Go to your dashboard
          </Link>
        </div>

        <div className="mt-8 max-w-md md:max-w-lg mx-auto bg-surface-container-low border border-outline-variant rounded-xl p-5 text-left">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-3">
            A couple things to know
          </p>
          <BidProcessNotices />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Intro */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-2 h-2 rounded-full bg-primary" />
          <span className="text-label-sm text-primary uppercase tracking-wider font-semibold">New Bid</span>
        </div>
        <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-on-surface font-bold tracking-tight">
          Client Intake
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Tell us about the bid — we handle the technical paperwork from here.
        </p>
      </div>

      {/* Step progress */}
      <div className="bg-surface-container p-space-base rounded-xl flex flex-col gap-space-md shadow-sm">
        <span className="text-label-md font-bold text-primary">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </span>
        <div className="grid grid-cols-3 gap-space-xs w-full">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-surface-container-highest"
              }`}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 text-center">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`text-label-sm ${
                i === step ? "text-primary font-bold" : "text-on-surface-variant font-medium"
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      {step === 0 && showProfileUpload && (
        <section className="bg-surface-container p-space-base rounded-xl space-y-space-base shadow-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
            <h2 className="font-headline text-[18px] text-on-surface font-bold">Want to save some typing?</h2>
          </div>
          <p className="text-body-md text-on-surface-variant">
            Upload a company document (capability statement, license packet, insurance certificates) and
            we&apos;ll fill in your Company Profile — you can always add or fix details there later.
          </p>
          <CompanyProfileUpload onExtracted={handleProfileExtracted} />
          {profileUploadDone && (
            <p className="text-body-md text-primary">Got it — filled in what we found.</p>
          )}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full min-h-[52px] bg-primary-container hover:bg-primary text-on-primary-container font-headline text-[16px] font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-space-sm active:scale-[0.99] transition-all"
          >
            {profileUploadDone ? "Continue" : "Skip for now"}
            <span className="material-symbols-outlined font-bold">arrow_forward</span>
          </button>
        </section>
      )}

      {step === 0 && !showProfileUpload && (
        <form onSubmit={handleAboutYouNext} className="flex flex-col gap-space-lg">
          <section className="bg-surface-container p-space-base rounded-xl space-y-space-base shadow-sm">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
              <h2 className="font-headline text-[18px] text-on-surface font-bold">Tell us about your business</h2>
            </div>
            <Input label="Company name" value={form.companyName} onChange={(v) => update("companyName", v)} required />
            <Input label="Your name" value={form.contactName} onChange={(v) => update("contactName", v)} required />
            <div className="flex flex-col gap-space-2xs">
              <Input label="Email or phone" value={form.contact} onChange={(v) => update("contact", v)} required />
              <p className="text-body-sm text-on-surface-variant">
                We'll use this to send updates on your bid.
              </p>
            </div>
            <Input label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} required />
            <p className="text-body-sm text-on-surface-variant">
              NAICS codes, small business status, and set-asides can be added later from your Company Profile.
            </p>
          </section>
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] bg-primary-container hover:bg-primary text-on-primary-container font-headline text-[16px] font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-space-sm active:scale-[0.99] transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Next"}
            {!saving && <span className="material-symbols-outlined font-bold">arrow_forward</span>}
          </button>
        </form>
      )}

      {step === 1 && showBidUpload && (
        <section className="bg-surface-container p-space-base rounded-xl space-y-space-base shadow-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
            <h2 className="font-headline text-[18px] text-on-surface font-bold">Want to save some typing?</h2>
          </div>
          <RfpDocumentUpload onExtracted={handleBidExtracted} />
          {bidUploadDone && (
            <p className="text-body-md text-primary">
              Got it — filled in what we found. Double-check the due date before continuing.
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowBidUpload(false)}
            className={
              bidUploadDone
                ? "w-full min-h-[52px] bg-primary-container hover:bg-primary text-on-primary-container font-headline text-[16px] font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-space-sm active:scale-[0.99] transition-all"
                : "w-full py-2 text-body-md text-on-surface-variant hover:text-primary underline underline-offset-2 flex items-center justify-center gap-1 transition-colors"
            }
          >
            {bidUploadDone ? (
              <>
                Continue
                <span className="material-symbols-outlined font-bold">arrow_forward</span>
              </>
            ) : (
              "Or enter bid details manually"
            )}
          </button>
        </section>
      )}

      {step === 1 && !showBidUpload && (
        <form onSubmit={handleAboutBidNext} className="flex flex-col gap-space-lg">
          <section className="bg-surface-container p-space-base rounded-xl space-y-space-base shadow-sm">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
              <h2 className="font-headline text-[18px] text-on-surface font-bold">Tell us about the job</h2>
            </div>
            <Input
              label="Who is asking for this? (the agency or department)"
              value={form.agency}
              onChange={(v) => update("agency", v)}
              required
            />
            <div className="flex flex-col gap-space-2xs">
              <Input
                label="Bid or RFP number (if you have one)"
                value={form.solicitationNumber}
                onChange={(v) => update("solicitationNumber", v)}
              />
              <p className="text-body-sm text-on-surface-variant">
                This is the number the agency put on the job posting, if there is one.
              </p>
            </div>
            <Input label="Due date" type="date" value={form.dueDate} onChange={(v) => update("dueDate", v)} />
            <div className="flex flex-col gap-space-2xs">
              <label className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">
                What does the job involve?
              </label>
              <textarea
                value={form.scope}
                onChange={(e) => update("scope", e.target.value)}
                rows={4}
                className="w-full border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg placeholder:text-outline focus:outline-none focus:ring-0 focus:bg-surface-container-highest"
              />
            </div>
          </section>
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] bg-primary-container hover:bg-primary text-on-primary-container font-headline text-[16px] font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-space-sm active:scale-[0.99] transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Next"}
            {!saving && <span className="material-symbols-outlined font-bold">arrow_forward</span>}
          </button>
        </form>
      )}

      {step === 2 && submissionId && clientId && (
        <section className="bg-surface-container p-space-base rounded-xl space-y-space-base shadow-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">folder_zip</span>
            <h2 className="font-headline text-[18px] text-on-surface font-bold">Your bid file</h2>
          </div>
          <p className="text-body-md text-on-surface-variant">
            Upload the RFP file from the agency, if you have it. You can also
            add this later.
          </p>
          <BidFileStep
            submissionId={submissionId}
            clientId={clientId}
            onSubmitted={() => {
              setSubmitted(true);
              setFitCheckLoading(true);
              // Fire-and-forget, same as the fit-check fetch — clientId is
              // already known at this point (BidFileStep requires it), and
              // RLS already lets a client read their own clients row and
              // certification count.
              (async () => {
                const [{ data: clientRow }, { count: certCount }] = await Promise.all([
                  supabase
                    .from("clients")
                    .select(
                      "naics_codes, license_number, business_registration_number, insurance_provider, general_liability_coverage, workers_comp_coverage, business_address, business_phone"
                    )
                    .eq("id", clientId)
                    .maybeSingle(),
                  supabase
                    .from("client_certifications")
                    .select("id", { count: "exact", head: true })
                    .eq("client_id", clientId),
                ]);
                if (clientRow) {
                  setCompletenessPercent(
                    computeProfileCompleteness({
                      naicsCodes: clientRow.naics_codes,
                      licenseNumber: clientRow.license_number,
                      businessRegistrationNumber: clientRow.business_registration_number,
                      insuranceProvider: clientRow.insurance_provider,
                      generalLiabilityCoverage: clientRow.general_liability_coverage,
                      workersCompCoverage: clientRow.workers_comp_coverage,
                      businessAddress: clientRow.business_address,
                      businessPhone: clientRow.business_phone,
                      hasCertification: (certCount ?? 0) > 0,
                    }).percent
                  );
                }
              })().catch(() => {});
            }}
            onFitCheck={(result) => {
              setFitCheck(result);
              setFitCheckLoading(false);
            }}
          />
        </section>
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
    <div className="flex flex-col gap-space-2xs">
      <label className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg placeholder:text-outline focus:outline-none focus:ring-0 focus:bg-surface-container-highest"
      />
    </div>
  );
}
