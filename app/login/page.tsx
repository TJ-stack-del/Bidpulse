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
              src="/login-logo.png"
              alt="BidPulse"
              width={142}
              height={112}
              className="h-28 w-auto mx-auto dark:hidden"
              priority
            />
            <Image
              src="/login-logo-dark.png"
              alt="BidPulse"
              width={142}
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

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
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
