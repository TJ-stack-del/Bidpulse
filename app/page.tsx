import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOrgAndMembership } from "@/lib/auth/ensure-org";
import { MarketingShell } from "@/components/ui/MarketingShell";
import { KNOWN_TRADES } from "@/lib/compliance/known-trades";

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
// matching card, rather than silently drifting until a screenshot catches it.
const MISSING_TRADE_CARDS = KNOWN_TRADES.filter(
  (trade) => !TRADES.some((card) => card.id === trade.id)
);
if (MISSING_TRADE_CARDS.length > 0) {
  throw new Error(
    `"Trades we work with" section (app/page.tsx) is missing a card for: ${MISSING_TRADE_CARDS.map((t) => t.id).join(", ")}. Add a matching entry to TRADES.`
  );
}

function Home() {
  return (
    <MarketingShell activePath="/">
      <section className="flex flex-col items-center text-center gap-6 py-8">
        <h1 className="text-display-lg text-primary max-w-3xl">
          We help you win local government contracts.
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-xl">
          Send us the bid papers. We write the parts that trip people up — so you can
          send in a strong bid.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          <Link
            href="/intake"
            className="px-8 py-4 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] flex items-center gap-2"
          >
            Get started
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
          <Link
            href="/gallery"
            className="px-8 py-4 border border-outline-variant text-on-surface rounded text-label-md hover:bg-surface-container-low transition active:scale-[0.97]"
          >
            See examples
          </Link>
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

      <section className="flex flex-col gap-gutter">
        <div className="flex flex-col gap-2 max-w-2xl">
          <h2 className="text-headline-lg text-primary">How it works</h2>
          <p className="text-body-md text-on-surface-variant">
            Three steps, from your side of things — we handle everything else.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {HOW_IT_WORKS.map((step) => (
            <div
              key={step.title}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-gutter flex flex-col gap-4"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${step.badge}`}>
                <span className="material-symbols-outlined">{step.icon}</span>
              </div>
              <h3 className="text-headline-md text-primary">{step.title}</h3>
              <p className="text-body-sm text-on-surface-variant">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

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

      <section className="flex flex-col items-center text-center gap-4">
        <h2 className="text-headline-md text-primary">Not sure if this is for you?</h2>
        <p className="text-body-sm text-on-surface-variant max-w-lg">
          See sample pricing, browse example deliverables, or read answers to common
          questions.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/pricing" className="text-secondary font-bold hover:underline">
            View pricing
          </Link>
          <Link href="/gallery" className="text-secondary font-bold hover:underline">
            See examples
          </Link>
          <Link href="/faq" className="text-secondary font-bold hover:underline">
            Read the FAQ
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
