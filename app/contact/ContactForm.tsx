"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send your message. Please try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center flex flex-col items-center gap-3 py-6">
        <span className="material-symbols-outlined text-secondary text-[40px]">check_circle</span>
        <h2 className="text-title-lg text-primary">Message sent</h2>
        <p className="text-body-md text-on-surface-variant">
          Thanks, {name.split(" ")[0] || "there"} — we&apos;ll get back to you at {email} soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-label-md text-on-surface-variant">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-label-md text-on-surface-variant">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-label-md text-on-surface-variant">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none resize-y"
        />
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
      >
        {sending && <Spinner />}
        Send message
      </button>
    </form>
  );
}
