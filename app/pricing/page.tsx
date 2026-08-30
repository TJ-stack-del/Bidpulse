import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/ui/MarketingShell";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, manually-confirmed pricing for done-for-you bid prep — pilot, one-off, and retainer options.",
};

// Manual invoicing for now per BUILD-ORDER-BIDPULSE.md's "decisions
// already made" — no Stripe checkout, so every offer ends in "Get started"
// (the intake wizard) or a mailto, not a payment button. Mirrors
// packages.package_type: 'one_off' | 'retainer' | 'pilot'.

const PACKAGES = [
  {
    type: "pilot",
    name: "Pilot",
    tagline: "A low-commitment first bid, on us to prove the process.",
    features: ["One full bid, done for you", "See how the process works", "No commitment after"],
    cta: { label: "Get started", href: "/intake" },
    highlight: false,
  },
  {
    type: "one_off",
    name: "One-off",
    tagline: "A single bid, fully prepared.",
    features: ["The write-up about your company", "A checklist matching the agency's rules", "The technical write-up"],
    cta: { label: "Get started", href: "/intake" },
    highlight: true,
  },
  {
    type: "retainer",
    name: "Retainer",
    tagline: "Ongoing coverage for teams bidding regularly.",
    features: ["We watch for new bids every month", "Up to 2 full bids a month", "One person who knows your file"],
    cta: { label: "Email us", href: "mailto:hello@bidpulse.com" },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <MarketingShell activePath="/pricing">
      <section className="text-center flex flex-col gap-2">
        <h1 className="text-headline-lg text-primary">Pricing</h1>
        <p className="text-body-md text-on-surface-variant">
          We confirm exact pricing with you directly before any work starts — no card
          required today.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {PACKAGES.map((pkg) => (
          <article
            key={pkg.type}
            className={`bg-surface-container-lowest rounded-lg p-gutter flex flex-col gap-6 relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
              pkg.highlight
                ? "border border-secondary shadow-md md:-translate-y-2"
                : "border border-outline-variant hover:border-secondary/50"
            }`}
          >
            <div className={`absolute top-0 left-0 w-1 h-full ${pkg.highlight ? "bg-secondary" : "bg-surface-dim"}`} />
            {pkg.highlight && (
              <div className="absolute top-0 right-0 bg-secondary text-on-secondary text-label-sm py-1 px-3 rounded-bl-lg">
                Popular
              </div>
            )}
            <header className="flex flex-col gap-2">
              <h2 className="text-headline-md text-primary">{pkg.name}</h2>
              <p className="text-body-sm text-on-surface-variant">{pkg.tagline}</p>
            </header>
            <ul className="flex flex-col gap-3 flex-grow">
              {pkg.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                  <span className="text-body-md text-on-surface">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={pkg.cta.href}
              className={`py-3 px-4 rounded text-label-md text-center transition active:scale-[0.97] ${
                pkg.highlight
                  ? "bg-secondary text-on-secondary hover:bg-on-secondary-container"
                  : "bg-surface-container-low text-on-surface border border-outline hover:bg-surface-container-high"
              }`}
            >
              {pkg.cta.label}
            </Link>
          </article>
        ))}
      </section>

      <section className="p-gutter bg-surface-container-low rounded-lg border border-outline-variant flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
          <h3 className="text-body-lg font-semibold text-on-surface">Not sure which one fits?</h3>
          <p className="text-body-sm text-on-surface-variant">
            Just start the bid form — we'll figure out the right plan together.
          </p>
        </div>
        <Link
          href="/intake"
          className="shrink-0 py-2 px-6 border border-primary text-primary rounded text-label-md hover:bg-surface-container-high transition active:scale-[0.97]"
        >
          Start a bid
        </Link>
      </section>
    </MarketingShell>
  );
}
