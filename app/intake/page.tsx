import { IntakeWizard } from "./IntakeWizard";

// Public route — a client doesn't need an account before starting.
// Their account gets created as part of step 1 ("About you"). Replaces
// the old self-serve app/(app)/intake — this one is NOT wrapped in
// AppShell since the visitor isn't logged into the app yet.

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center px-margin-mobile md:px-margin-desktop py-4 border-b border-outline-variant">
        <span className="text-headline-md font-bold text-on-surface">BidPulse</span>
      </header>
      <main className="max-w-[700px] mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <IntakeWizard />
      </main>
    </div>
  );
}
