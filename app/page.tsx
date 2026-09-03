import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOrgAndMembership } from "@/lib/auth/ensure-org";
import { MarketingShell } from "@/components/ui/MarketingShell";
import { KNOWN_TRADES, assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import { FaqAccordion } from "@/app/faq/FaqAccordion";

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

  // Signed in, but neither row exists yet: the only legitimate case left is
  // an already-pending admin account whose org_name metadata was set by the
  // admin signup form back when it existed — that form has since been
  // removed (single-org business, no legitimate reason for a second org to
  // ever get created through the UI again), but this self-heal path stays
  // so any account still mid-confirmation from before the removal finishes
  // setting up on next login instead of being left stuck.
  if (user.user_metadata?.org_name) {
    await ensureOrgAndMembership(supabase, user);
    redirect("/admin/inbox");
  }

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
    cta: { label: "Get started", href: "/intake" },
  },
  {
    name: "One-off",
    tagline: "A single bid, fully prepared.",
    terms: "Confirmed with you before work starts",
    cta: { label: "Get started", href: "/intake" },
  },
  {
    name: "Retainer",
    tagline: "Ongoing coverage for teams bidding regularly.",
    terms: "Up to 2 full bids a month",
    cta: { label: "Email us", href: "mailto:hello@bidpulse.com" },
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
    q: "How does pricing work?",
    a: "We confirm pricing with you directly before any work starts — one-off, retainer, and pilot options are on the Pricing page. No card is required to get started.",
  },
];

function Home() {
  return (
    <MarketingShell activePath="/">
      {/* ---------- Hero ---------- */}
      <section className="flex flex-col items-center text-center gap-6 py-8">
        <span className="text-label-md font-code text-tertiary uppercase tracking-wide flex items-center gap-2">
          <span className="w-5 h-px bg-tertiary" aria-hidden="true" />
          Government bid prep · Jacksonville, FL
        </span>
        <h1 className="text-display-lg text-primary max-w-3xl">
          You run the crew. We handle <em className="italic text-tertiary">the paperwork</em>.
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-xl">
          Send us the bid. We turn it into a real capability statement, compliance
          checklist, and technical narrative — ready for you to review and send. No
          procurement jargon required.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          <Link
            href="/intake"
            className="px-8 py-4 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] flex items-center gap-2"
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

        {/* Document transform: messy RFP in, clean capability statement out —
            same idea as the "before/after" panel in the printed deliverable
            itself (see lib/pdf/deliverables-packet.ts), just rendered live. */}
        <div className="flex items-center justify-center gap-6 md:gap-10 pt-8 flex-wrap">
          <div className="w-56 md:w-64 aspect-[7/9] bg-surface-container-lowest border border-outline-variant rounded shadow-lg p-6 -rotate-3 shrink-0">
            <div className="flex gap-1.5 mb-3">
              <span className="font-code text-[8px] px-1.5 py-0.5 border border-outline-variant rounded text-on-surface-variant">
                ITB-C893
              </span>
              <span className="font-code text-[8px] px-1.5 py-0.5 border border-tertiary rounded text-tertiary">
                SET-ASIDE
              </span>
            </div>
            <div className="h-1.5 bg-outline-variant rounded mb-2" />
            <div className="h-1.5 bg-outline-variant rounded mb-2 w-1/2" />
            <div className="h-1.5 bg-outline-variant rounded mb-3 w-1/4" />
            <div className="border border-outline-variant rounded divide-y divide-outline-variant mb-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-2 p-1.5">
                  <span className="h-1.5 flex-1 bg-outline-variant/70 rounded" />
                  <span className="h-1.5 flex-1 bg-outline-variant/70 rounded" />
                  <span className="h-1.5 flex-1 bg-outline-variant/70 rounded" />
                </div>
              ))}
            </div>
            <div className="h-1.5 bg-outline-variant rounded mb-2" />
            <div className="h-1.5 bg-outline-variant rounded w-2/3 mb-4" />
            <p className="text-center text-label-sm font-code text-on-surface-variant uppercase tracking-wide">
              the RFP
            </p>
          </div>

          <span className="material-symbols-outlined text-tertiary text-4xl shrink-0 hidden sm:block" aria-hidden="true">
            arrow_forward
          </span>

          <div className="relative w-56 md:w-64 aspect-[7/9] bg-surface border border-outline-variant rounded shadow-lg p-6 rotate-2 shrink-0">
            <div className="absolute top-5 right-4 w-20 h-20 rounded-full border-2 border-tertiary flex items-center justify-center -rotate-[14deg]">
              <span className="text-[9px] font-code text-tertiary text-center leading-tight uppercase">
                Ready
                <br />
                to send
              </span>
            </div>
            <h3 className="text-title-lg text-primary mb-0.5 pr-16 text-left">Coastal HVAC Services</h3>
            <p className="font-code text-[9px] text-on-surface-variant uppercase tracking-wide mb-4 text-left">
              Capability statement
            </p>
            <div className="h-1 w-8 bg-tertiary rounded mb-2" />
            <div className="h-1.5 bg-outline-variant/60 rounded mb-1.5 w-11/12" />
            <div className="h-1.5 bg-outline-variant/60 rounded mb-1.5 w-4/5" />
            <div className="h-1.5 bg-outline-variant/60 rounded mb-4 w-5/6" />
            {[100, 100, 45].map((width, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-3.5 h-3.5 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary text-[10px]">check</span>
                </span>
                <span className="h-1.5 bg-outline-variant/60 rounded" style={{ width: `${width * 0.6}%` }} />
              </div>
            ))}
            <p className="text-center text-label-sm font-code text-on-surface-variant uppercase tracking-wide mt-4">
              what you send
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center gap-6">
        <span className="text-label-md text-secondary font-bold uppercase tracking-wide border border-secondary rounded-full px-4 py-1">
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
              <span className="material-symbols-outlined text-secondary text-[28px]">{item.icon}</span>
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
              <span className="material-symbols-outlined text-secondary mt-1">{trade.icon}</span>
              <div>
                <h4 className="text-label-md text-primary uppercase tracking-wide">{trade.title}</h4>
                <p className="text-body-sm text-on-surface-variant mt-1">{trade.body}</p>
              </div>
            </li>
          ))}
        </ul>
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
        <div className="border-t border-outline-variant">
          {PRICING_PREVIEW.map((tier) => (
            <div
              key={tier.name}
              className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 md:gap-8 py-8 border-b border-outline-variant md:items-center"
            >
              <h3 className="text-headline-md text-primary">{tier.name}</h3>
              <div>
                <p className="text-body-md text-on-surface-variant">{tier.tagline}</p>
                <p className="text-label-sm font-code text-on-surface-variant uppercase tracking-wide mt-2">
                  {tier.terms}
                </p>
              </div>
              <Link href={tier.cta.href} className="text-secondary font-bold hover:underline whitespace-nowrap">
                {tier.cta.label}
              </Link>
            </div>
          ))}
        </div>
        <Link href="/pricing" className="text-secondary font-bold hover:underline self-start">
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
        <Link href="/faq" className="text-secondary font-bold hover:underline text-center">
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
          className="px-8 py-4 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">assignment</span>
          Get started
        </Link>
      </section>
    </MarketingShell>
  );
}
