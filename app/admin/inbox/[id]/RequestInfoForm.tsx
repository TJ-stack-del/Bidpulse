"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";

// Pre-fills from the Fit Check explanation since that's the one real source
// of admin-facing "what's missing" text today (a single joined paragraph,
// not separate structured suggestions) — the admin edits it down to
// whatever actually needs to go to the client before sending.
export function RequestInfoForm({
  submissionId,
  prefillText,
}: {
  submissionId: string;
  prefillText: string;
}) {
  const [message, setMessage] = useState(prefillText);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/request-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, message: message.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error ?? "Couldn't send the request.", "error");
        return;
      }

      if (data.sent) {
        showToast("Request sent to client.", "success");
      } else if (data.reason === "test_submission") {
        showToast("Checklist item added (test submission — no email sent).", "success");
      } else if (data.reason === "no_client_email") {
        showToast("Checklist item added, but this client has no email on file.", "error");
      }

      setSent(true);
      setMessage("");
      router.refresh();
    } catch {
      showToast("Couldn't send the request.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-[20px]">mail</span>
        Request info from client
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSent(false);
          }}
          rows={4}
          placeholder="What do you need from the client?"
          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
        />
        <p className="text-label-md text-on-surface-variant">
          This creates a checklist item the client can see and emails them directly.
        </p>
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="self-start py-2.5 px-5 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <Spinner />}
          {submitting ? "Sending…" : "Send request"}
        </button>
      </form>
    </div>
  );
}
