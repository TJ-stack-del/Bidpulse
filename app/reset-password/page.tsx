import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Reset Password",
};

// No signed-in redirect here (unlike app/login/page.tsx) — reaching this
// page via the emailed recovery link means being signed in is the whole
// point, not a reason to bounce away.
export default function ResetPasswordPage() {
  return (
    <main className="animate-fade-in min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="block w-fit mx-auto mb-4 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Image
              src="/login-logo.svg"
              alt="BidPulse"
              width={224}
              height={224}
              className="h-[var(--auth-logo-height)] w-auto mx-auto dark:hidden"
              priority
            />
            <Image
              src="/login-logo-dark.svg"
              alt="BidPulse"
              width={224}
              height={224}
              className="hidden h-[var(--auth-logo-height)] w-auto mx-auto dark:block"
              priority
            />
          </Link>
          <Reveal mode="mount" as="div">
            <span className="font-bold text-headline-lg text-primary">Reset your password</span>
            <p className="text-body-md text-on-surface-variant mt-2">Choose a new password below.</p>
          </Reveal>
        </div>

        {/* dark:bg-surface-container-low override -- see app/login/page.tsx
            for the full reasoning (the two themes need opposite container
            tiers for genuine elevation; -lowest is correct in light mode,
            -low is correct in dark mode). Kept in sync with the login
            card's same fix. */}
        <Reveal mode="mount" delay={0.08} className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-8">
          <ResetPasswordForm />
        </Reveal>
      </div>
    </main>
  );
}
