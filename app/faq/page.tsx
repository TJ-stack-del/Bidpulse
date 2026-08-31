import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/ui/MarketingShell";
import { FaqAccordion } from "./FaqAccordion";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about BidPulse's done-for-you bid prep service.",
};

const CATEGORIES = [
  {
    name: "About BidPulse",
    faqs: [
      {
        q: "What is BidPulse?",
        a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix, and technical narrative for you.",
      },
      {
        q: "Do you guarantee I'll win the bid?",
        a: "No one can guarantee an award. What we guarantee is a complete, compliant submission prepared by people who've done this before.",
      },
      {
        q: "Is my data secure?",
        a: "Your submission and files are tied to your account only, and every status change on your bid is recorded in an audit trail.",
      },
    ],
  },
  {
    name: "Pricing",
    faqs: [
      {
        q: "How does pricing work?",
        a: "We confirm pricing with you directly before any work starts — one-off, retainer, and pilot options are on the Pricing page. No card is required to get started.",
      },
    ],
  },
  {
    name: "Getting started",
    faqs: [
      {
        q: "What do I need to get started?",
        a: "Just the RFP itself (or a link to it) and basic company info — NAICS codes, small-business status, and set-asides if you have them.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <MarketingShell activePath="/faq">
      <section className="max-w-2xl mx-auto w-full flex flex-col gap-4 text-center">
        <h1 className="text-headline-lg text-primary">Frequently asked questions</h1>
        <p className="text-body-lg text-on-surface-variant">
          Straight answers about how BidPulse works.
        </p>
      </section>

      <section className="max-w-3xl mx-auto w-full flex flex-col gap-10">
        {CATEGORIES.map((cat) => (
          <div key={cat.name} className="flex flex-col gap-4">
            <h2 className="text-headline-md text-primary border-b border-outline-variant pb-2">{cat.name}</h2>
            <FaqAccordion faqs={cat.faqs} />
          </div>
        ))}
      </section>

      <section className="text-center flex flex-col items-center gap-4">
        <p className="text-body-lg text-on-surface-variant">Can&apos;t find the answer you&apos;re looking for?</p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97]"
        >
          Contact support
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </section>
    </MarketingShell>
  );
}
