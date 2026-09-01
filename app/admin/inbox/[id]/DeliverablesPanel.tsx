"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";
import { PacketButtons } from "@/components/ui/PacketButtons";
import { signRfpDocumentUrl } from "@/lib/storage";
import { useToast } from "@/components/Toast";

type Deliverable = {
  id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

const FULL_DELIVERABLE_TYPES: { value: string; label: string }[] = [
  { value: "capability_statement", label: "Capability statement" },
  { value: "compliance_matrix", label: "Compliance matrix" },
  { value: "technical_narrative", label: "Technical narrative" },
];

// For informal quotes under the org's lean_package_threshold — the full
// 3-deliverable set is overkill for a small job. Admin-confirmed, never
// automatic: estimated_value is often a rough guess, not authoritative, so
// silently swapping the whole deliverable set on a save would be surprising.
const LEAN_DELIVERABLE_TYPES: { value: string; label: string }[] = [
  { value: "rate_sheet", label: "Rate sheet" },
  { value: "executive_cover", label: "Executive cover" },
  { value: "certificate_of_insurance", label: "Certificate of insurance" },
];

function deliverableLabel(type: string) {
  return [...FULL_DELIVERABLE_TYPES, ...LEAN_DELIVERABLE_TYPES].find((d) => d.value === type)?.label ?? type;
}

// Step 7 — admin prepares each deliverable either by pasting text or
// uploading a file; either counts as "prepared" per BUILD-ORDER-BIDPULSE.md
// ("start simple"). One row per deliverable_type: saving replaces whichever
// row already exists for that type instead of piling up duplicates, since
// schema.sql has no unique constraint enforcing that itself.
export function DeliverablesPanel({
  submissionId,
  orgId,
  actorId,
  initialDeliverables,
  lastPacketView,
  estimatedValue,
  leanPackageThreshold,
}: {
  submissionId: string;
  orgId: string;
  actorId: string;
  initialDeliverables: Deliverable[];
  lastPacketView: { event_type: string; created_at: string } | null;
  estimatedValue: number | null;
  leanPackageThreshold: number;
}) {
  const [byType, setByType] = useState<Record<string, Deliverable | undefined>>(() => {
    const map: Record<string, Deliverable | undefined> = {};
    for (const d of initialDeliverables) map[d.deliverable_type] = d;
    return map;
  });
  // Sticky across reloads: if a lean-type deliverable already exists, stay
  // in lean mode rather than reverting to the full set and hiding it.
  const [leanMode, setLeanMode] = useState(() =>
    initialDeliverables.some((d) => LEAN_DELIVERABLE_TYPES.some((t) => t.value === d.deliverable_type))
  );
  const DELIVERABLE_TYPES = leanMode ? LEAN_DELIVERABLE_TYPES : FULL_DELIVERABLE_TYPES;
  const showLeanSuggestion =
    !leanMode && estimatedValue != null && estimatedValue > 0 && estimatedValue < leanPackageThreshold;
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const d of initialDeliverables) map[d.deliverable_type] = d.content ?? "";
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [savedTypes, setSavedTypes] = useState<Record<string, boolean>>({});
  const supabase = createClient();
  const { showToast } = useToast();

  async function logPrepared(type: string, mode: "file" | "text") {
    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "deliverable_prepared",
      event_detail: { deliverable_type: type, mode },
    });
  }

  async function upsert(type: string, fields: { file_url?: string | null; content?: string | null }) {
    const existing = byType[type];
    const payload = {
      submission_id: submissionId,
      deliverable_type: type,
      prepared_by: actorId,
      file_url: fields.file_url ?? null,
      content: fields.content ?? null,
    };

    if (existing) {
      const { data, error: updateError } = await supabase
        .from("deliverables")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Couldn't save.");
      return data as Deliverable;
    }

    const { data, error: insertError } = await supabase
      .from("deliverables")
      .insert(payload)
      .select()
      .single();
    if (insertError || !data) throw new Error(insertError?.message ?? "Couldn't save.");
    return data as Deliverable;
  }

  async function handleSaveText(type: string) {
    setSaving(type);
    setSavedTypes((s) => ({ ...s, [type]: false }));
    try {
      const saved = await upsert(type, { content: drafts[type] ?? "" });
      setByType((b) => ({ ...b, [type]: saved }));
      await logPrepared(type, "text");
      setSavedTypes((s) => ({ ...s, [type]: true }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save.";
      showToast(`${deliverableLabel(type)}: ${message}`, "error");
    } finally {
      setSaving(null);
    }
  }

  // Fills the text box with a generated starting draft — doesn't touch the
  // deliverables table itself, so nothing is saved until the admin hits
  // "Save text" as usual. Confirms first if there's existing content, since
  // this replaces the box wholesale rather than appending.
  async function handleAutoDraft(type: string) {
    const label = DELIVERABLE_TYPES.find((d) => d.value === type)?.label ?? type;
    const existingText = (drafts[type] ?? "").trim();
    if (existingText) {
      const confirmed = window.confirm(
        `This will replace the current ${label.toLowerCase()} text with a generated draft. Continue?`
      );
      if (!confirmed) return;
    }

    setGenerating(type);
    setSavedTypes((s) => ({ ...s, [type]: false }));

    try {
      const res = await fetch("/api/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, deliverableType: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't generate a draft.");
      setDrafts((d) => ({ ...d, [type]: data.content }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't generate a draft.";
      showToast(`${deliverableLabel(type)}: ${message}`, "error");
    } finally {
      setGenerating(null);
    }
  }

  async function handleUpload(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(type);
    setSavedTypes((s) => ({ ...s, [type]: false }));

    try {
      const path = `${submissionId}/deliverables/${type}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("rfp-documents").upload(path, file);
      if (uploadError) throw new Error(uploadError.message);

      // The bucket is private — the DB stores the bare path (`saved.file_url`
      // below), and every read site (including this one, right after upload)
      // generates its own signed URL rather than persisting one, since a
      // signed URL expires.
      const saved = await upsert(type, { file_url: path });
      const signedUrl = await signRfpDocumentUrl(supabase, path);
      setByType((b) => ({ ...b, [type]: { ...saved, file_url: signedUrl } }));
      setDrafts((d) => ({ ...d, [type]: "" }));
      await logPrepared(type, "file");
      setSavedTypes((s) => ({ ...s, [type]: true }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      showToast(`${deliverableLabel(type)}: ${message}`, "error");
    } finally {
      setSaving(null);
      e.target.value = "";
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-[20px]">description</span>
        Deliverables
      </h2>

      {showLeanSuggestion && (
        <div className="mb-6 bg-surface-container-highest border border-outline-variant rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-body-md text-on-surface">
            This bid is estimated at ${estimatedValue!.toLocaleString()}, under the $
            {leanPackageThreshold.toLocaleString()} lean-package threshold — a lean package (Rate Sheet +
            Executive Cover + Certificate of Insurance) may be more appropriate than the full deliverable set.
          </p>
          <button
            onClick={() => setLeanMode(true)}
            className="px-4 py-2 rounded border border-secondary text-secondary text-label-md font-bold hover:bg-surface-container-low transition active:scale-[0.97] shrink-0"
          >
            Switch to lean package
          </button>
        </div>
      )}
      {leanMode && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-label-md text-on-surface-variant">Using the lean package.</p>
          <button onClick={() => setLeanMode(false)} className="text-label-md text-secondary hover:underline">
            Use full package instead
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {DELIVERABLE_TYPES.map((t) => {
          const existing = byType[t.value];
          const isSaving = saving === t.value;
          const isGenerating = generating === t.value;
          const isBusy = isSaving || isGenerating;
          return (
            <div key={t.value} className="border-t border-outline-variant pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider">{t.label}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                    existing
                      ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {existing ? "Draft" : "Not started"}
                </span>
              </div>

              {existing?.file_url && (
                <a
                  href={existing.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary font-bold hover:underline text-body-md block mb-2"
                >
                  Current file
                </a>
              )}

              <textarea
                value={drafts[t.value] ?? ""}
                onChange={(e) => {
                  setDrafts((d) => ({ ...d, [t.value]: e.target.value }));
                  setSavedTypes((s) => ({ ...s, [t.value]: false }));
                }}
                rows={3}
                placeholder="Paste or write the content directly…"
                className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none mb-2"
              />

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => handleAutoDraft(t.value)}
                  disabled={isBusy}
                  className="px-4 py-2 rounded border border-outline-variant text-on-surface text-label-md font-bold hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
                >
                  {isGenerating ? <Spinner /> : <span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                  {isGenerating ? "Generating…" : "Auto-draft"}
                </button>
                <button
                  onClick={() => handleSaveText(t.value)}
                  disabled={isBusy}
                  className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
                >
                  {isSaving && <Spinner />}
                  {isSaving ? "Saving…" : "Save text"}
                </button>
                <label className="px-4 py-2 rounded border border-secondary text-secondary text-label-md font-bold hover:bg-surface-container-low transition active:scale-[0.97] cursor-pointer flex items-center gap-2">
                  {isSaving && <Spinner />}
                  {isSaving ? "Saving…" : "Upload file instead"}
                  <input
                    type="file"
                    onChange={(e) => handleUpload(t.value, e)}
                    disabled={isBusy}
                    className="hidden"
                  />
                </label>
                <FadeMessage show={!!savedTypes[t.value]} className="text-body-md text-secondary">
                  Saved
                </FadeMessage>
              </div>
            </div>
          );
        })}

        <div className="border-t border-outline-variant pt-4">
          <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
            Complete bid package
          </h3>
          <PacketButtons submissionId={submissionId} orgId={orgId} viewerRole="admin" />
          <p className="text-label-md text-on-surface-variant mt-3">
            {lastPacketView
              ? `Client last ${lastPacketView.event_type === "client_downloaded_packet" ? "downloaded" : "viewed"}: ${new Date(
                  lastPacketView.created_at
                ).toLocaleString()}`
              : "Not yet viewed"}
          </p>
        </div>
      </div>
    </div>
  );
}
