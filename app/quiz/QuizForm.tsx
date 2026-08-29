"use client";

import { useState } from "react";
import Link from "next/link";

// 4-question RFP fit-score quiz per BUILD-ORDER-SPECWRIGHT.md Step 3 — pure
// lead-gen, no schema table for it, so nothing here is persisted.

const QUESTIONS = [
  "Do you have an upcoming RFP deadline in the next 30 days?",
  "Have you submitted a government or agency bid before?",
  "Do you already have a compliance matrix or capability statement ready?",
  "Are you a certified small business (WOSB, SDVOSB, 8(a), HUBZone, etc.)?",
];

export function QuizForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  function answer(value: boolean) {
    setAnswers((a) => [...a, value]);
    setStep((s) => s + 1);
  }

  if (step >= QUESTIONS.length) {
    const yesCount = answers.filter(Boolean).length;
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 flex flex-col gap-4 text-center">
        <h2 className="text-headline-md text-on-surface">
          {yesCount >= 2 ? "You're a strong fit." : "We can still help."}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {yesCount >= 2
            ? "Based on your answers, you're well-positioned to bid — let's get your submission prepared."
            : "Every bidder starts somewhere. Send us your RFP and we'll take it from there."}
        </p>
        <Link
          href="/intake"
          className="self-center px-6 py-3 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors"
        >
          Start your bid
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 flex flex-col gap-6">
      <div className="flex gap-2">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${i <= step ? "bg-secondary" : "bg-outline-variant"}`}
          />
        ))}
      </div>

      <h2 className="text-headline-md text-on-surface">{QUESTIONS[step]}</h2>

      <div className="flex gap-3">
        <button
          onClick={() => answer(true)}
          className="flex-1 py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => answer(false)}
          className="flex-1 py-3 px-4 bg-surface border border-outline-variant rounded text-label-md hover:bg-surface-container-high transition-colors"
        >
          No
        </button>
      </div>
    </div>
  );
}
