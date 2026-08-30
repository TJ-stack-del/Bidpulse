import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  return (
    <main className="animate-fade-in min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="BidPulse" width={162} height={56} className="h-14 w-auto mx-auto mb-4" priority />
          <span className="font-bold text-headline-lg text-primary">Welcome back</span>
          <p className="text-body-md text-on-surface-variant mt-2">Sign in to your account.</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <LoginForm />
        </div>

        <p className="text-body-md text-on-surface-variant text-center mt-6">
          Submitting a bid for the first time?{" "}
          <Link href="/intake" className="text-secondary hover:underline">
            Start here
          </Link>
        </p>
        <p className="text-body-md text-on-surface-variant text-center mt-2">
          Setting up your team&apos;s admin workspace for the first time?{" "}
          <Link href="/admin/signup" className="text-secondary hover:underline">
            Create it
          </Link>
        </p>
      </div>
    </main>
  );
}
