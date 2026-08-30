import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TAGLINE } from "@/lib/brand";
import { SignupForm } from "./SignupForm";

// Admin-only signup — creates the organizations + team_members(role: admin)
// rows. This is you/your team, done rarely (often just once). Clients never
// land here: they get an account as part of the intake wizard's "About
// you" step instead (see app/intake/IntakeWizard.tsx).

export default async function AdminSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  return (
    <main className="animate-fade-in min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="BidPulse" width={162} height={56} className="h-14 w-auto mx-auto" priority />
          <p className="text-label-sm text-on-surface-variant max-w-xs mx-auto mt-1 mb-4">{TAGLINE}</p>
          <span className="font-bold text-headline-lg text-primary">Create your account</span>
          <p className="text-body-md text-on-surface-variant mt-2">
            Set up your BidPulse admin workspace.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-secondary" />
          <SignupForm />
        </div>

        <p className="text-body-md text-on-surface-variant text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-secondary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
