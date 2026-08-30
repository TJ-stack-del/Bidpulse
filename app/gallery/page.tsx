import type { Metadata } from "next";
import { MarketingShell } from "@/components/ui/MarketingShell";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Example deliverables — synthetic samples showing the kind of write-ups we prepare for HVAC, janitorial, and landscaping bids.",
};

// Clearly-labeled synthetic examples only — never a real client's data.
// No photos here (the mockups used hotlinked stock-photo placeholders,
// which don't belong in a real app) — a colored icon header stands in.

const EXAMPLES = [
  {
    trade: "HVAC",
    icon: "hvac",
    accent: "bg-primary-fixed text-on-primary-fixed",
    title: "Systems & Installation",
    excerpt:
      "Sample Co. HVAC has completed 40+ commercial installation and retrofit jobs across three states, with a 98% on-time completion rate and NATE-certified technicians on every crew.",
  },
  {
    trade: "Janitorial",
    icon: "cleaning_services",
    accent: "bg-secondary-container text-on-secondary-container",
    title: "Commercial Cleaning",
    excerpt:
      "Sample Clean Services holds current bonding and insurance for facilities up to 500,000 sq ft, and has maintained continuous janitorial contracts with two school districts since 2019.",
  },
  {
    trade: "Landscaping",
    icon: "yard",
    accent: "bg-tertiary-fixed text-on-tertiary-fixed",
    title: "Grounds Maintenance",
    excerpt:
      "Sample Grounds Co. maintains 30+ acres of public parkland year-round, with a dedicated irrigation-repair crew and same-week response for storm cleanup.",
  },
];

export default function GalleryPage() {
  return (
    <MarketingShell activePath="/gallery">
      <section className="text-center flex flex-col gap-2">
        <h1 className="text-headline-lg text-primary">Example deliverables</h1>
        <p className="text-body-md text-on-surface-variant max-w-lg mx-auto">
          Illustrative samples only — synthetic company names and figures, not a real
          client's work.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {EXAMPLES.map((ex) => (
          <div
            key={ex.trade}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-secondary/50"
          >
            <div className={`h-32 flex items-center justify-center ${ex.accent}`}>
              <span className="material-symbols-outlined text-[40px]">{ex.icon}</span>
            </div>
            <div className="p-gutter flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider">{ex.trade}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded border border-outline-variant bg-surface-container-low text-on-surface-variant font-bold uppercase">
                  Sample
                </span>
              </div>
              <h3 className="text-headline-md text-primary">{ex.title}</h3>
              <p className="text-body-sm text-on-surface-variant">{ex.excerpt}</p>
            </div>
          </div>
        ))}
      </section>
    </MarketingShell>
  );
}
