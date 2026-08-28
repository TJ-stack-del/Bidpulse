import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="font-bold text-headline-lg text-on-surface">BidPulse</span>
          <p className="text-body-md text-on-surface-variant mt-2">Sign in to your workspace</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <LoginForm />
        </div>

        <p className="text-body-md text-on-surface-variant text-center mt-6">
          Don&apos;t have an organization yet?{" "}
          <Link href="/signup" className="text-secondary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
