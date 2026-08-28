"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AccountSecurityPanel({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);
  const supabase = createClient();

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    setSavingPassword(false);
    if (error) {
      setPasswordMessage(error.message);
      return;
    }
    setPassword("");
    setPasswordMessage("Password updated.");
  }

  async function handleSignOutOthers() {
    setSigningOutOthers(true);
    setSignOutMessage(null);

    const { error } = await supabase.auth.signOut({ scope: "others" });

    setSigningOutOthers(false);
    setSignOutMessage(error ? error.message : "Signed out of all other sessions.");
  }

  return (
    <>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
        <h2 className="text-title-lg text-on-surface mb-1">Account</h2>
        <p className="text-body-md text-on-surface-variant mb-4">{email}</p>

        <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">New Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
            />
          </label>
          {passwordMessage && (
            <p className={`text-body-md ${passwordMessage === "Password updated." ? "text-on-tertiary-container" : "text-error"}`}>
              {passwordMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={savingPassword || password.length < 6}
            className="py-2 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingPassword ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
        <h2 className="text-title-lg text-on-surface mb-1">Session Control</h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Sign out of this account everywhere else it's currently logged in.
        </p>
        {signOutMessage && <p className="text-body-md text-on-surface-variant mb-3">{signOutMessage}</p>}
        <button
          onClick={handleSignOutOthers}
          disabled={signingOutOthers}
          className="w-full py-2 border border-error text-error rounded text-label-md hover:bg-error-container/20 transition-colors disabled:opacity-50"
        >
          {signingOutOthers ? "Signing out…" : "Sign out of all other sessions"}
        </button>
      </div>
    </>
  );
}
