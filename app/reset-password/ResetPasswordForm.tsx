"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

// Reached only via the emailed recovery link -> /auth/callback (exchanges
// the code for a real session) -> here. checkingSession distinguishes "the
// exchange hasn't resolved yet" from "there's genuinely no session," since
// the latter means the link was already used, expired, or this page was
// opened directly — none of which this form can do anything about.
export function ResetPasswordForm() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setHasSession(!!user);
        setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="text-secondary" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-body-md text-on-surface-variant">
          This reset link is invalid or has expired. Request a new one from the login page.
        </p>
        <Link href="/login" className="text-body-md text-secondary hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-body-md text-on-surface-variant">
          Password updated. Taking you to your dashboard…
        </p>
        <Spinner className="text-secondary mx-auto" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <p className="text-body-md text-error bg-error-container/20 border border-error/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant">Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <Spinner />}
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
