import type { Metadata } from "next";
import { MarketingShell } from "@/components/ui/MarketingShell";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the BidPulse team.",
};

export default function ContactPage() {
  return (
    <MarketingShell activePath="/contact">
      <section className="max-w-xl mx-auto w-full flex flex-col gap-4 text-center">
        <h1 className="text-headline-lg text-primary">Contact us</h1>
        <p className="text-body-lg text-on-surface-variant">
          Questions about a bid, your account, or anything else — send us a message and we&apos;ll get back to you.
        </p>
      </section>

      <section className="max-w-xl mx-auto w-full">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8">
          <ContactForm />
        </div>
      </section>
    </MarketingShell>
  );
}
