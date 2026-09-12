import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_TRADES, assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import { FaqAccordion } from "@/app/(marketing)/faq/FaqAccordion";
import { TransformationPipeline } from "@/components/ui/TransformationPipeline";

export const metadata: Metadata = {
  description: "We help you win local government contracts. Send us the bid papers — our team handles the paperwork so you can send in a strong bid.",
};

// Also the one place that decides where a signed-in user actually lands —
// see MIGRATION-TO-BIDPULSE.md: admin (team_members) and client (clients)
// are two completely separate account types now, so routing has to branch
// on which row exists rather than sending everyone to the same dashboard.
// An anonymous visitor gets the public marketing homepage instead (Step 3).
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <Home />;

  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (member) redirect("/admin/inbox");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (client) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12 text-center">
      <p className="text-body-md text-error">No account found for this login. Contact support.</p>
    </main>
  );
}

const HOW_IT_WORKS = [
  {
    icon: "search",
    badge: "bg-primary-fixed text-on-primary-fixed",
    title: "1. Tell us about the bid",
    body: "A three-step form: your company info, the agency and job details, and the bid file itself.",
  },
  {
    icon: "fact_check",
    badge: "bg-secondary-container text-on-secondary-container",
    title: "2. We do the work",
    body: "Our team writes the paperwork about your company, checks it against the agency's rules, and writes up the technical part.",
  },
  {
    icon: "task",
    badge: "bg-tertiary-fixed text-on-tertiary-fixed",
    title: "3. You review and send it",
    body: "You check everything over. We confirm once it's actually sent in to the agency.",
  },
];

// "HVAC", "IT / Computer Support" -> "HVAC" / "IT / computer support": lowercases
// each word except ones already fully uppercase (acronyms), so labels read
// naturally mid-sentence instead of as a title-cased list.
function toSentenceCase(label: string): string {
  return label
    .split(" ")
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(" ");
}

// Sourced from known-trades.ts (the trade-coverage safety net's source of
// truth) so this copy can't go stale again the next time a vertical is added.
const SUPPORTED_TRADES_LIST = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
  KNOWN_TRADES.map((trade) => toSentenceCase(trade.label))
);

const TRADES = [
  {
    id: "hvac",
    icon: "hvac",
    title: "HVAC",
    body: "Installation, maintenance, and repair contracts for public buildings.",
  },
  {
    id: "janitorial",
    icon: "cleaning_services",
    title: "Janitorial",
    body: "Cleaning and facility-upkeep contracts for schools, offices, and public spaces.",
  },
  {
    id: "landscaping",
    icon: "yard",
    title: "Landscaping",
    body: "Grounds maintenance and lawn care contracts for cities, parks, and school districts.",
  },
  {
    id: "it-computer-support",
    icon: "computer",
    title: "IT / Computer Support",
    body: "Help desk, network support, and technical-service contracts for schools, agencies, and public offices.",
  },
  {
    id: "electrical",
    icon: "electrical_services",
    title: "Electrical",
    body: "Panel upgrades, lighting retrofits, and wiring contracts for municipal and school facilities.",
  },
];

// Each id here must match a KNOWN_TRADES id — this section needs a real
// authored icon + description per trade, so it can't be generated from
// known-trades.ts the way the tagline above is. Instead this fails the
// build/render loudly the moment a new trade ships there without a
// matching card, rather than silently drifting until a screenshot catches
// it (which is exactly how Gallery's separate card list drifted before
// this check existed for it too — see app/gallery/page.tsx).
assertNoMissingTradeCards(
  TRADES.map((t) => t.id),
  '"Trades we work with" section (app/page.tsx)'
);

// Mirrors app/pricing/page.tsx's PACKAGES (name/tagline/first two features per
// tier) — keep these two in sync by hand if pricing copy changes. Duplicated
// rather than imported because pricing/page.tsx doesn't export PACKAGES, and
// this preview intentionally shows fewer features per tier than the full page.
const PRICING_PREVIEW = [
  {
    name: "Pilot",
    tagline: "A low-commitment first bid, on us to prove the process.",
    terms: "No commitment after",
    features: ["One full bid, done for you", "See how the process works"],
    cta: { label: "Get started", href: "/intake" },
    highlight: false,
  },
  {
    name: "One-off",
    tagline: "A single bid, fully prepared.",
    terms: "Confirmed with you before work starts",
    features: ["The write-up about your company", "A checklist matching the agency's rules", "The technical write-up"],
    cta: { label: "Get started", href: "/intake" },
    highlight: true,
  },
  {
    name: "Retainer",
    tagline: "Ongoing coverage for teams bidding regularly.",
    terms: "Up to 2 full bids a month",
    features: ["We watch for new bids every month", "One person who knows your file"],
    cta: { label: "Email us", href: "mailto:hello@bidpulse.com" },
    highlight: false,
  },
];

// Mirrors the "About BidPulse" category in app/faq/page.tsx's CATEGORIES —
// same note on keeping these in sync applies.
const FAQ_PREVIEW = [
  {
    q: "What is BidPulse?",
    a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix, and technical narrative for you.",
  },
  {
    q: "Do you guarantee I'll win the bid?",
    a: "No one can guarantee an award. What we guarantee is a complete, compliant submission prepared by people who've done this before.",
  },
  {
    q: "Why do I submit the bid myself instead of BidPulse submitting it?",
    a: "You hold the reins. Government procurement portals tie submissions to your own company's registered vendor credentials, so you're the one who uploads and hits submit — we prepare the package, you stay in control of your own account.",
  },
  {
    q: "How does pricing work?",
    a: "We confirm pricing with you directly before any work starts — one-off, retainer, and pilot options are on the Pricing page. No card is required to get started. Every deliverable is free to preview before anything's due.",
  },
];

function Home() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="flex flex-col items-center text-center gap-6 py-8">
        <span className="text-label-md font-code text-tertiary uppercase tracking-wide flex items-center gap-2">
          <span className="w-5 h-px bg-tertiary" aria-hidden="true" />
          Government bid prep · Jacksonville, FL
        </span>
        <h1 className="text-display-lg text-primary font-bold max-w-3xl">
          You run the crew. We handle the paperwork.
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-xl">
          Upload the RFP. We turn complex solicitations into a ready-to-submit capability
          statement, compliance matrix, and technical narrative — so you can review, sign,
          and send.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          <Link
            href="/intake"
            className="px-8 py-4 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 transition active:scale-[0.97] flex items-center gap-2"
          >
            Start your bid
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
          <a
            href="#how"
            className="px-8 py-4 border border-outline-variant text-on-surface rounded text-label-md hover:bg-surface-container-low transition active:scale-[0.97]"
          >
            See how it works
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {TRADES.map((trade) => (
            <span
              key={trade.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-primary text-[14px]">{trade.icon}</span>
              {trade.title}
            </span>
          ))}
        </div>

        <TransformationPipeline />
      </section>

      <section className="flex flex-col items-center gap-6">
        <span className="text-label-md text-primary font-bold uppercase tracking-wide border border-primary rounded-full px-4 py-1">
          Now accepting founding clients
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter w-full">
          {[
            {
              icon: "chat",
              title: "Plain-language process",
              body: "No confusing paperwork jargon — we explain everything in plain English.",
            },
            {
              icon: "construction",
              title: "You focus on the job",
              body: "We handle the writing so you can keep running your business.",
            },
            {
              icon: "storefront",
              title: "Built for small trades",
              body: `Not a big consulting firm — made for ${SUPPORTED_TRADES_LIST} contractors.`,
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center text-center gap-2 p-gutter">
              <span className="material-symbols-outlined text-primary text-[28px]">{item.icon}</span>
              <h3 className="text-title-lg text-primary">{item.title}</h3>
              <p className="text-body-sm text-on-surface-variant">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section
        id="how"
        className="bg-primary text-on-primary -mx-margin-mobile md:-mx-margin-desktop px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col gap-gutter"
      >
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="text-label-md font-code text-tertiary uppercase tracking-wide">The process</span>
          <h2 className="text-headline-lg text-on-primary">
            Three steps. You&apos;re never the one filling out the form.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-code text-body-md">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="text-headline-md text-on-primary">{step.title.replace(/^\d+\.\s*/, "")}</h3>
              <p className="text-body-sm text-on-primary/70">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="text-body-sm text-on-primary/70 flex items-center gap-2">
          <span className="material-symbols-outlined text-on-primary text-[18px] shrink-0">verified_user</span>
          We never submit on your behalf — you stay in control of your own agency portal account.
        </p>
      </section>

      {/* ---------- Trades ---------- */}
      <section className="bg-surface-container-low border-y border-outline-variant -mx-margin-mobile md:-mx-margin-desktop px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col gap-gutter">
        <div className="flex flex-col gap-2 max-w-2xl">
          <h2 className="text-headline-lg text-primary">Trades we work with</h2>
          <p className="text-body-md text-on-surface-variant">
            We're set up for the kind of bids small trade businesses actually deal with.
          </p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TRADES.map((trade) => (
            <li
              key={trade.title}
              className="flex items-start gap-4 p-gutter border border-outline-variant rounded bg-surface"
            >
              <span className="material-symbols-outlined text-primary mt-1">{trade.icon}</span>
              <div>
                <h4 className="text-label-md text-primary uppercase tracking-wide">{trade.title}</h4>
                <p className="text-body-sm text-on-surface-variant mt-1">{trade.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {/* The intake flow already accepts any trade and gives an honest
            heads-up (not a rejection) when it's outside the trades above with
            deep compliance-matrix coverage — see lib/compliance/known-trades.ts.
            This copy makes that explicit instead of implying a harder gate
            than the product actually has. Points at the intake CTA, not a
            contact form, since a reply-and-wait step is the wrong thing to
            introduce at the exact moment someone's deciding whether to try
            BidPulse — the product already answers the question for free. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <p className="text-body-sm text-on-surface-variant">
            We&apos;re deepest in these five — but if you&apos;re in a related trade, go
            ahead and{" "}
            <Link href="/intake" className="text-primary font-bold hover:underline">
              start your bid
            </Link>
            . You&apos;ll get an honest heads-up right away if something&apos;s outside our
            sweet spot (a trade outside these five gets less tailored compliance
            guidance, but we&apos;ll tell you that up front, not after you&apos;ve paid).
            Prefer to ask first?{" "}
            <Link href="/contact" className="text-primary font-bold hover:underline">
              Contact us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ---------- Pricing (rate sheet, not a card grid) ---------- */}
      <section id="pricing" className="flex flex-col gap-gutter">
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="text-label-md font-code text-tertiary uppercase tracking-wide">Working with us</span>
          <h2 className="text-headline-lg text-primary">No subscriptions. We invoice after the work&apos;s done.</h2>
          <p className="text-body-md text-on-surface-variant">
            Every deliverable is free to preview in full before anything&apos;s due. We
            confirm exact pricing with you directly before any work starts.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {PRICING_PREVIEW.map((tier) => (
            <div
              key={tier.name}
              className={`bg-surface-container-low rounded-xl p-space-base flex flex-col gap-space-md shadow-sm ${
                tier.highlight ? "ring-2 ring-primary" : ""
              }`}
            >
              {tier.highlight && (
                <span className="self-start px-2 py-0.5 rounded bg-primary-container text-on-primary-container text-label-sm font-bold uppercase tracking-wider">
                  Most popular
                </span>
              )}
              <div>
                <h3 className="text-headline-md text-primary">{tier.name}</h3>
                <p className="text-body-md text-on-surface-variant mt-1">{tier.tagline}</p>
              </div>
              <ul className="flex flex-col gap-2 flex-grow">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-label-sm font-code text-on-surface-variant uppercase tracking-wide">{tier.terms}</p>
              <Link
                href={tier.cta.href}
                className="mt-auto px-4 py-2.5 bg-primary-container hover:bg-primary text-on-primary-container rounded-lg text-label-md font-bold text-center transition active:scale-[0.97]"
              >
                {tier.cta.label}
              </Link>
            </div>
          ))}
        </div>
        <Link href="/pricing" className="text-primary font-bold hover:underline self-start">
          See full pricing →
        </Link>
      </section>

      {/* ---------- FAQ preview ---------- */}
      <section id="faq" className="flex flex-col gap-gutter max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-label-md font-code text-tertiary uppercase tracking-wide">
            Before you send us a bid
          </span>
          <h2 className="text-headline-lg text-primary">Questions contractors actually ask</h2>
        </div>
        <FaqAccordion faqs={FAQ_PREVIEW} />
        <Link href="/faq" className="text-primary font-bold hover:underline text-center">
          Read the full FAQ →
        </Link>
      </section>

      <section className="bg-primary-container text-on-primary-container rounded-xl px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col items-center text-center gap-6">
        <h2 className="text-headline-lg text-on-primary-container max-w-2xl">
          Ready to send in a strong bid?
        </h2>
        <p className="text-body-md text-on-primary-container/80 max-w-xl">
          Tell us about your bid. It only takes a few minutes.
        </p>
        <Link
          href="/intake"
          className="px-8 py-4 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 transition active:scale-[0.97] flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">assignment</span>
          Get started
        </Link>
      </section>
    </>
  );
}
