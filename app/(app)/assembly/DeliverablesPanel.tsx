"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Deliverable = {
  id: string;
  artifact_type: string;
  title: string;
  file_url: string | null;
  version: number;
  signed_off: boolean;
  signed_off_at: string | null;
  team_members: { full_name: string } | null;
};

export function DeliverablesPanel({
  items,
  bidId,
  orgId,
  actorId,
  artifactTypes,
}: {
  items: Deliverable[];
  bidId: string;
  orgId: string;
  actorId: string;
  artifactTypes: string[];
}) {
  const [title, setTitle] = useState("");
  const [artifactType, setArtifactType] = useState(artifactTypes[0]);
  const [fileUrl, setFileUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);

    const { error: insertError } = await supabase.from("deliverables").insert({
      bid_id: bidId,
      artifact_type: artifactType,
      title,
      file_url: fileUrl || null,
    });

    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setFileUrl("");
    router.refresh();
  }

  async function toggleSignOff(item: Deliverable) {
    setBusyId(item.id);
    setError(null);
    const nextSignedOff = !item.signed_off;

    const { error: updateError } = await supabase
      .from("deliverables")
      .update({
        signed_off: nextSignedOff,
        signed_off_by: nextSignedOff ? actorId : null,
        signed_off_at: nextSignedOff ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      setBusyId(null);
      return;
    }

    // Sign-offs are a compliance/legal action per README section 2 step 7.
    const { error: auditError } = await supabase.from("audit_log").insert({
      bid_id: bidId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "sign_off",
      event_detail: { deliverable_title: item.title, signed_off: nextSignedOff },
    });

    setBusyId(null);
    if (auditError) {
      setError(auditError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      {error && <p className="text-body-md text-error px-6 pt-4">{error}</p>}

      {items.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-outline-variant text-label-md text-on-surface-variant uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Version</th>
                <th className="px-6 py-3 font-medium">Sign-Off</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {items.map((item) => (
                <tr key={item.id} className="border-b border-outline-variant last:border-b-0">
                  <td className="px-6 py-3 text-on-surface">
                    {item.file_url ? (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-secondary hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </td>
                  <td className="px-6 py-3 text-on-surface-variant text-code-sm font-code">
                    {item.artifact_type.replace("_", " ")}
                  </td>
                  <td className="px-6 py-3 text-on-surface-variant">v{item.version}</td>
                  <td className="px-6 py-3">
                    {item.signed_off ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#E6F4EA] text-on-tertiary-container border border-on-tertiary-container/20 text-[10px] font-label-md uppercase tracking-wider">
                        Signed off by {item.team_members?.full_name ?? "team member"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant text-[10px] font-label-md uppercase tracking-wider">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => toggleSignOff(item)}
                      disabled={busyId === item.id}
                      className="text-secondary text-label-md hover:underline disabled:opacity-50"
                    >
                      {item.signed_off ? "Revoke" : "Sign Off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant px-6 py-6">No deliverables logged yet.</p>
      )}

      <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3 px-6 py-4 border-t border-outline-variant bg-surface">
        <select
          value={artifactType}
          onChange={(e) => setArtifactType(e.target.value)}
          className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          {artifactTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deliverable title"
          required
          className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        />
        <input
          type="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="Link (optional)"
          className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        />
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {adding ? "Adding…" : "Add Deliverable"}
        </button>
      </form>
    </div>
  );
}
