import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
};

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
    <main className="animate-fade-in min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="block w-fit mx-auto mb-4">
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
          <span className="font-bold text-headline-lg text-primary">Welcome back</span>
          <p className="text-body-md text-on-surface-variant mt-2">Sign in to your account.</p>
        </div>

        {reason === "inactive" && (
          <p className="text-body-md text-on-surface bg-surface-container-low border border-outline-variant rounded px-4 py-3 mb-6 text-center">
            You were signed out after 14 days of inactivity. Sign back in to continue.
          </p>
        )}

        {/* Dropped the shadow approach -- a light-background drop shadow
            doesn't read on a dark page (no light source to imply, nothing
            for the shadow to visually cast onto). Dark-theme elevation is
            surface lightness instead, but the two themes need opposite
            tokens: surface-container-lowest is pure white in light mode
            (255 255 255, genuinely lighter than surface's 247 249 251 --
            correctly elevated) but is actually *darker* than plain surface
            in dark mode (11 14 16 vs 16 20 22 -- the opposite of
            "elevated"). surface-container-low inverts that exact same way
            (242 244 246 in light mode, slightly darker than surface --
            wrong there; 25 28 30 in dark mode, genuinely lighter --
            right). So: keep -lowest as the light-mode default (unchanged,
            already correct), override to -low only in dark mode. Border
            unchanged (outline-variant already matches this app's existing
            subtle-border convention for every panel). Note: every other
            card/modal in this app still uses bare surface-container-lowest
            (e.g. ConfirmDeleteDialog.tsx) and so still has this same
            backwards-in-dark-mode elevation -- not fixed here, flagged
            since this brief was scoped to the login/reset-password cards
            specifically. */}
        <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-8">
          <LoginForm />
        </div>

        <p className="text-body-md text-on-surface-variant text-center mt-6">
          Submitting a bid for the first time?{" "}
          <Link href="/intake" className="text-secondary hover:underline">
            Start here
          </Link>
        </p>
      </div>
    </main>
  );
}
