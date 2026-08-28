"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateSha256 } from "@/lib/audit/export";

type ApiKey = {
  id: string;
  key_prefix: string;
  rate_limit_per_min: number;
  created_at: string;
  revoked_at: string | null;
};

function randomKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `bp_live_${token}`;
}

export function ApiKeysPanel({ apiKeys, orgId }: { apiKeys: ApiKey[]; orgId: string }) {
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    const key = randomKey();
    const hashedKey = await calculateSha256(key);
    const keyPrefix = key.slice(0, 12);

    const { error: insertError } = await supabase.from("api_keys").insert({
      org_id: orgId,
      key_prefix: keyPrefix,
      hashed_key: hashedKey,
    });

    setGenerating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewKey(key);
    router.refresh();
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    setRevokingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-body-md text-error">{error}</p>}

      {newKey && (
        <div className="bg-surface-container-low border border-secondary rounded p-4 flex flex-col gap-2">
          <p className="text-label-md text-on-surface font-bold">
            Copy this key now — it won't be shown again.
          </p>
          <code className="font-code text-code-sm text-on-surface break-all bg-surface p-2 rounded border border-outline-variant">
            {newKey}
          </code>
          <button
            onClick={() => setNewKey(null)}
            className="self-end text-secondary text-label-md hover:underline"
          >
            Done
          </button>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="self-start px-4 py-2 bg-primary-container text-on-primary rounded text-label-md flex items-center gap-2 hover:bg-on-background transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">key</span>
        {generating ? "Generating…" : "Generate New Key"}
      </button>

      <div className="border border-outline-variant rounded overflow-hidden flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low text-label-md text-on-surface-variant border-b border-outline-variant">
            <tr>
              <th className="py-3 px-3 font-medium">Key</th>
              <th className="py-3 px-3 font-medium">Created</th>
              <th className="py-3 px-3 font-medium">Rate Limit</th>
              <th className="py-3 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-body-md text-on-surface">
            {apiKeys.length > 0 ? (
              apiKeys.map((k) => (
                <tr key={k.id} className="border-b border-outline-variant last:border-b-0">
                  <td className="py-2 px-3 font-code text-code-sm flex items-center gap-2">
                    {k.key_prefix}…
                    {!k.revoked_at && <span className="w-2 h-2 rounded-full bg-on-tertiary-container" />}
                  </td>
                  <td className="py-2 px-3 text-code-sm text-on-surface-variant">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-code-sm text-on-surface-variant">{k.rate_limit_per_min}/min</td>
                  <td className="py-2 px-3 text-right">
                    {k.revoked_at ? (
                      <span className="text-on-surface-variant text-label-md">Revoked</span>
                    ) : (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revokingId === k.id}
                        className="text-error text-label-md hover:underline disabled:opacity-50"
                      >
                        {revokingId === k.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 px-3 text-center text-on-surface-variant">
                  No API keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
