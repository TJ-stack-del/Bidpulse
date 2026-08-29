import { IntakeWizard } from "./IntakeWizard";

// Public route — a client doesn't need an account before starting.
// Their account gets created as part of step 1 ("About you"). Replaces
// the old self-serve app/(app)/intake — this one is NOT wrapped in
// AppShell since the visitor isn't logged into the app yet.

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <span className="text-headline-md font-bold text-primary">BidPulse</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop py-section-gap">
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
