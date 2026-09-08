import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
};

// Same three real steps as the homepage's "How it works" section
// (app/page.tsx's HOW_IT_WORKS) — trimmed to one line each for the sign-in
// marketing panel. Duplicated here rather than imported since it's just
// three short strings and app/page.tsx's array isn't exported.
const PANEL_STEPS = [
  { icon: "search", title: "Tell us about the bid", body: "A three-step form: your company, the agency, and the bid file." },
  { icon: "fact_check", title: "We do the work", body: "We write the paperwork and check it against the agency's rules." },
  { icon: "task", title: "You review and send it", body: "You check everything over before it goes to the agency." },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  const { reason } = await searchParams;

  return (
    <main className="animate-fade-in min-h-screen flex flex-col md:flex-row bg-surface">
      {/* Marketing panel -- desktop only, matches the Stitch sign-in
          screen's split layout. Mobile collapses to just the auth card
          below, same as Stitch's dedicated mobile sign-in screen. */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative flex-col justify-center gap-10 px-16 py-12 bg-surface-container-low overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-container/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col gap-6 max-w-lg">
          <span className="text-label-md font-code text-tertiary uppercase tracking-wide flex items-center gap-2">
            <span className="w-5 h-px bg-tertiary" aria-hidden="true" />
            Government bid prep · Jacksonville, FL
          </span>
          <h1 className="font-headline text-headline-lg text-primary">
            You run the crew. We handle <em className="italic text-tertiary">the paperwork</em>.
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Send us the bid. We turn it into a real capability statement, compliance
            checklist, and technical narrative — ready for you to review and send.
          </p>
        </div>
        <div className="relative flex flex-col gap-5 max-w-lg">
          {PANEL_STEPS.map((step) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
              </div>
              <div>
                <h3 className="text-label-md text-on-surface font-bold">{step.title}</h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 relative flex items-center justify-center px-margin-mobile py-12 overflow-hidden">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-44 bg-primary-container/20 blur-3xl rounded-full pointer-events-none md:hidden" />
        <div className="w-full max-w-md relative">
          <div className="text-center mb-6">
            <Link href="/" className="relative flex items-center justify-center mb-3">
              <Image
                src="/icon.svg"
                alt="BidPulse"
                width={96}
                height={96}
                className="w-24 h-24 object-contain drop-shadow-[0_0_16px_rgb(var(--color-primary)/0.5)]"
                priority
              />
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high mb-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-label-sm uppercase tracking-wider text-secondary">Client Portal</span>
            </div>
            <h1 className="font-headline text-headline-lg-mobile text-on-surface tracking-tight font-bold">
              Bid<span className="text-primary">Pulse</span>
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1">Sign in to your account.</p>
          </div>

          {reason === "inactive" && (
            <p className="text-body-md text-on-surface bg-surface-container-low rounded-xl px-4 py-3 mb-6 text-center">
              You were signed out after 14 days of inactivity. Sign back in to continue.
            </p>
          )}

          <div className="bg-surface-container-low rounded-2xl p-5 shadow-xl">
            <LoginForm />
          </div>

          <p className="text-body-md text-on-surface-variant text-center mt-6">
            Submitting a bid for the first time?{" "}
            <Link href="/intake" className="text-primary hover:underline">
              Start here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
