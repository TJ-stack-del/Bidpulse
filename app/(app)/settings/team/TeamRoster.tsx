"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; full_name: string; email: string; role: string; created_at: string };

export function TeamRoster({
  members,
  roles,
  canManage,
  currentMemberId,
  orgId,
}: {
  members: Member[];
  roles: string[];
  canManage: boolean;
  currentMemberId: string;
  orgId: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function updateRole(id: string, role: string) {
    setBusyId(id);
    setError(null);

    const { error: updateError } = await supabase.from("team_members").update({ role }).eq("id", id);

    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface-container-low border-b border-outline-variant text-label-md text-on-surface-variant">
          <div className="col-span-5">Member</div>
          <div className="col-span-4">Role</div>
          <div className="col-span-3">Joined</div>
        </div>
        {members.map((m) => (
          <div
            key={m.id}
            className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-outline-variant last:border-b-0 items-center"
          >
            <div className="col-span-5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-label-md font-bold shrink-0">
                {m.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-body-md font-medium text-on-surface truncate">
                  {m.full_name}
                  {m.id === currentMemberId && <span className="text-on-surface-variant"> (you)</span>}
                </div>
                <div className="text-code-sm text-on-surface-variant truncate">{m.email}</div>
              </div>
            </div>
            <div className="col-span-4">
              {canManage ? (
                <select
                  value={m.role}
                  onChange={(e) => updateRole(m.id, e.target.value)}
                  disabled={busyId === m.id}
                  className="bg-surface border border-outline-variant rounded px-2 py-1 text-body-md text-on-surface focus:outline-none focus:border-secondary disabled:opacity-50"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-label-md">
                  {m.role.replace("_", " ")}
                </span>
              )}
            </div>
            <div className="col-span-3 text-body-md text-on-surface-variant">
              {new Date(m.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {canManage && <AddMemberForm roles={roles} orgId={orgId} />}
    </div>
  );
}

function AddMemberForm({ roles, orgId }: { roles: string[]; orgId: string }) {
  const [authUserId, setAuthUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[roles.length - 1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("team_members").insert({
      org_id: orgId,
      auth_user_id: authUserId,
      full_name: fullName,
      email,
      role,
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setAuthUserId("");
    setFullName("");
    setEmail("");
    router.refresh();
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h3 className="text-title-lg text-on-surface mb-1">Add Team Member</h3>
      <p className="text-body-md text-on-surface-variant mb-4">
        For a user who already has a Supabase Auth account (Authentication → Users in the Supabase
        dashboard — copy their User UID from there).
      </p>
      {error && <p className="text-body-md text-error mb-3">{error}</p>}
      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          value={authUserId}
          onChange={(e) => setAuthUserId(e.target.value)}
          placeholder="Auth User UID"
          required
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary md:col-span-2"
        />
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          required
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Adding…" : "Add Member"}
        </button>
      </form>
    </div>
  );
}
