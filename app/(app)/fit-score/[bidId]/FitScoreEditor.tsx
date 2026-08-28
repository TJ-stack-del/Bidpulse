"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ScoringBreakdown } from "./page";

type Factor = { label: string; score: number; note?: string };

export function FitScoreEditor({
  bidId,
  currentScore,
  currentBreakdown,
}: {
  bidId: string;
  currentScore: number | null;
  currentBreakdown: ScoringBreakdown;
}) {
  const [fitScore, setFitScore] = useState(currentScore?.toString() ?? "");
  const [verdict, setVerdict] = useState(currentBreakdown.verdict ?? "");
  const [factors, setFactors] = useState<Factor[]>(
    currentBreakdown.factors && currentBreakdown.factors.length > 0
      ? currentBreakdown.factors
      : [{ label: "", score: 0, note: "" }]
  );
  const [strengths, setStrengths] = useState((currentBreakdown.strengths ?? []).join("\n"));
  const [risks, setRisks] = useState((currentBreakdown.risks ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function updateFactor(i: number, patch: Partial<Factor>) {
    setFactors((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const breakdown: ScoringBreakdown = {
      verdict: verdict || undefined,
      factors: factors.filter((f) => f.label.trim().length > 0),
      strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
      risks: risks.split("\n").map((s) => s.trim()).filter(Boolean),
    };

    const { error: updateError } = await supabase
      .from("bids")
      .update({
        fit_score: fitScore === "" ? null : Number(fitScore),
        scoring_breakdown: breakdown,
      })
      .eq("id", bidId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {error && <p className="text-body-md text-error">{error}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Fit Score (0-100)</span>
        <input
          type="number"
          min={0}
          max={100}
          value={fitScore}
          onChange={(e) => setFitScore(e.target.value)}
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Verdict</span>
        <textarea
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
          rows={3}
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary resize-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Factors</span>
        {factors.map((factor, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="text"
              value={factor.label}
              onChange={(e) => updateFactor(i, { label: e.target.value })}
              placeholder="Label (e.g. NAICS Alignment)"
              className="flex-1 bg-surface border border-outline-variant rounded px-2 py-1.5 text-body-md text-on-surface focus:outline-none focus:border-secondary"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={factor.score}
              onChange={(e) => updateFactor(i, { score: Number(e.target.value) })}
              className="w-20 bg-surface border border-outline-variant rounded px-2 py-1.5 text-body-md text-on-surface focus:outline-none focus:border-secondary"
            />
            <button
              type="button"
              onClick={() => setFactors((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-on-surface-variant hover:text-error px-1"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFactors((prev) => [...prev, { label: "", score: 0, note: "" }])}
          className="self-start text-secondary text-label-md hover:underline"
        >
          + Add Factor
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
          Key Strengths (one per line)
        </span>
        <textarea
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          rows={3}
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary resize-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
          Potential Risks (one per line)
        </span>
        <textarea
          value={risks}
          onChange={(e) => setRisks(e.target.value)}
          rows={3}
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary resize-none"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Fit Analysis"}
      </button>
    </form>
  );
}
