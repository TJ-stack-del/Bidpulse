import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { IntakeWizard } from "./IntakeWizard";

// Public route — a client doesn't need an account before starting.
// Their account gets created as part of step 1 ("About you"). Replaces
// the old self-serve app/(app)/intake — this one is NOT wrapped in
// AppShell since the visitor isn't logged into the app yet.

export const metadata: Metadata = {
  title: "Get Started",
  description: "Tell us about your bid — we'll take it from there.",
};

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          {/* Links to /pricing, not "/" — root routing bounces a signed-in
              user (this flow creates an account partway through step 1)
              straight back into the app, same reason AppShell's logo does
              the same thing. */}
          <Link href="/pricing" className="flex items-center">
            <Logo priority />
          </Link>
        </div>
      </header>
      <main className="animate-fade-in max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop py-section-gap">
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-margin-mobile md:p-gutter shadow-sm">
          <h1 className="text-headline-lg-mobile md:text-headline-lg text-primary mb-8">
            Client Intake
          </h1>
          <IntakeWizard />
        </div>
      </main>
    </div>
  );
}
