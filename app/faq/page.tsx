import { MarketingShell } from "@/components/ui/MarketingShell";

const FAQS = [
  {
    q: "What is BidPulse?",
    a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix, and technical narrative for you.",
  },
  {
    q: "How does pricing work?",
    a: "We confirm pricing with you directly before any work starts — one-off, retainer, and pilot options are on the Pricing page. No card is required to get started.",
  },
  {
    q: "Do you guarantee I'll win the bid?",
    a: "No one can guarantee an award. What we guarantee is a complete, compliant submission prepared by people who've done this before.",
  },
  {
    q: "What do I need to get started?",
    a: "Just the RFP itself (or a link to it) and basic company info — NAICS codes, small-business status, and set-asides if you have them.",
  },
  {
    q: "Is my data secure?",
    a: "Your submission and files are tied to your account only, and every status change on your bid is recorded in an audit trail.",
  },
];

export default function FaqPage() {
  return (
    <MarketingShell activePath="/faq">
      <section className="max-w-2xl mx-auto w-full flex flex-col gap-8">
        <h1 className="text-headline-lg text-on-surface text-center">Frequently asked questions</h1>
        <div className="flex flex-col gap-6">
          {FAQS.map((item) => (
            <div key={item.q}>
              <h2 className="text-title-lg text-on-surface mb-1">{item.q}</h2>
              <p className="text-body-md text-on-surface-variant">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
