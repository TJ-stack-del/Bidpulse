"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RolePerms = {
  role: string;
  can_view_admin: boolean;
  can_view_margin_data: boolean;
  can_sign_off: boolean;
  can_manage_team: boolean;
  can_export_audit_log: boolean;
};

const FLAGS: { key: keyof Omit<RolePerms, "role">; label: string; detail: string }[] = [
  {
    key: "can_view_admin",
    label: "View Admin Portal",
    detail: "Access to /admin, /admin/review, /admin/sign-off, and /settings/roles.",
  },
  {
    key: "can_sign_off",
    label: "Sign Off",
    detail: "Authorize deliverable packages, admin audits, and client review completion.",
  },
  {
    key: "can_manage_team",
    label: "Manage Team",
    detail: "Add team members, change roles, and manage API keys on /settings/team and /settings/security.",
  },
  {
    key: "can_export_audit_log",
    label: "Export Audit Log",
    detail: "Download the full audit log from /admin/audit-log.",
  },
  {
    key: "can_view_margin_data",
    label: "View Margin Data",
    detail: "Represents access to pricing/margin figures on bids — not yet enforced by a specific page.",
  },
];

export function RolePermissionsEditor({
  roles,
  activeCounts,
}: {
  roles: RolePerms[];
  activeCounts: Record<string, number>;
}) {
  const [selectedRole, setSelectedRole] = useState(roles[0]?.role ?? "");
  const [draft, setDraft] = useState<Record<string, RolePerms>>(
    Object.fromEntries(roles.map((r) => [r.role, r]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const current = draft[selectedRole];
  const original = roles.find((r) => r.role === selectedRole);

  function toggle(key: keyof Omit<RolePerms, "role">) {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], [key]: !prev[selectedRole][key] },
    }));
  }

  function reset() {
    if (!original) return;
    setDraft((prev) => ({ ...prev, [selectedRole]: original }));
    setSaved(false);
  }

  async function handleSave() {
    if (!current) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { can_view_admin, can_view_margin_data, can_sign_off, can_manage_team, can_export_audit_log } = current;
    const { error: updateError } = await supabase
      .from("role_permissions")
      .update({ can_view_admin, can_view_margin_data, can_sign_off, can_manage_team, can_export_audit_log })
      .eq("role", selectedRole);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (!current) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {roles.map((r) => (
            <button
              key={r.role}
              onClick={() => setSelectedRole(r.role)}
              className={`w-full text-left px-4 py-3 border-b border-outline-variant last:border-b-0 text-label-md transition-colors ${
                r.role === selectedRole
                  ? "bg-surface-container-high text-secondary font-bold"
                  : "text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {r.role.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-9 flex flex-col gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-title-lg text-on-surface capitalize mb-1">{selectedRole.replace("_", " ")}</h2>
            <span className="px-3 py-1 bg-surface-container-low text-on-surface-variant rounded-full text-code-sm border border-outline-variant">
              {activeCounts[selectedRole] ?? 0} active user{(activeCounts[selectedRole] ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 border border-outline-variant text-on-surface rounded text-label-md hover:bg-surface-container-low transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md flex items-center gap-2 hover:bg-on-background transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {error && <p className="text-body-md text-error">{error}</p>}
        {saved && !error && <p className="text-body-md text-on-tertiary-container">Saved.</p>}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-6">
          {FLAGS.map((flag) => (
            <label key={flag.key} className="flex justify-between items-start gap-4 cursor-pointer">
              <div className="flex-1">
                <span className="text-body-md font-bold text-on-surface block mb-1">{flag.label}</span>
                <span className="text-label-md text-on-surface-variant">{flag.detail}</span>
              </div>
              <input
                type="checkbox"
                checked={current[flag.key]}
                onChange={() => toggle(flag.key)}
                className="mt-1 w-9 h-5 accent-secondary shrink-0"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
