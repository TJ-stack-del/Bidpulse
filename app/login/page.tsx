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
              width={112}
              height={112}
              className="h-28 w-auto mx-auto dark:hidden"
              priority
            />
            <Image
              src="/login-logo-dark.svg"
              alt="BidPulse"
              width={112}
              height={112}
              className="hidden h-28 w-auto mx-auto dark:block"
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

        {/* Two-layer elevation matching the mockup reference's shape (a
            tight near shadow + a soft far shadow) -- tint is the real
            --color-primary token (rgb(var(...)/alpha), same pattern
            tailwind.config.ts's color definitions already use), not the
            mockup's own rgba(27,42,74,...) numbers, since primary is navy
            in light mode but flips to a light blue in dark mode -- using
            the token keeps the shadow color correct in both instead of
            baking in one fixed hue. */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-[0_1px_2px_rgb(var(--color-primary)/0.08),0_12px_32px_rgb(var(--color-primary)/0.10)]">
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
