"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureOrgAndMembership } from "@/lib/auth/ensure-org";
import { Spinner } from "@/components/ui/Spinner";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // user_metadata carries full_name/org_name through to the root page's
    // ensureOrgAndMembership() fallback for the case below where confirmation
    // is required and we don't get a session (so can't write to the DB) yet.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, org_name: orgName } },
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Unable to create your account.");
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      // Project has "Confirm email" turned on — no session yet, so RLS
      // won't let us insert organizations/team_members until the user
      // confirms and logs in (see app/page.tsx).
      setPendingConfirmation(true);
      setSubmitting(false);
      return;
    }

    try {
      await ensureOrgAndMembership(supabase, data.user, { fullName, orgName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set up your workspace.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (pendingConfirmation) {
    return (
      <p className="text-body-md text-on-surface">
        We sent a confirmation link to <span className="font-bold">{email}</span>. Click it, then{" "}
        <a href="/login" className="text-secondary hover:underline">
          sign in
        </a>{" "}
        to finish setting up {orgName || "your organization"}.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <p className="text-body-md text-error bg-error-container/20 border border-error/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <Field label="Full Name" type="text" value={fullName} onChange={setFullName} autoComplete="name" icon="person" required />
      <Field label="Organization Name" type="text" value={orgName} onChange={setOrgName} autoComplete="organization" icon="business" required />
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" icon="mail" required />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        icon="lock"
        required
        minLength={6}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <Spinner />}
        {submitting ? "Creating workspace…" : "Create Account"}
      </button>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  icon,
  required,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  icon?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none text-[20px]">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`w-full bg-surface border border-outline-variant rounded py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary transition ${
            icon ? "pl-10 pr-3" : "px-3"
          }`}
        />
      </div>
    </label>
  );
}
