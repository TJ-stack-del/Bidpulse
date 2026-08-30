"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Unable to sign in.");
      setSubmitting(false);
      return;
    }

    // Deliberately no org/membership setup here — a client sign-in must
    // never create an organizations/team_members row (see app/page.tsx,
    // which handles the one case that legitimately needs that: an admin
    // signup that was still pending email confirmation).
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <p className="text-body-md text-error bg-error-container/20 border border-error/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        icon="mail"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        icon="lock"
        required
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <Spinner />}
        {submitting ? "Signing in…" : "Sign In"}
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
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  icon?: string;
  required?: boolean;
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
          className={`w-full bg-surface border border-outline-variant rounded py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary transition ${
            icon ? "pl-10 pr-3" : "px-3"
          }`}
        />
      </div>
    </label>
  );
}
