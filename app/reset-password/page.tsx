import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

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
          <span className="font-bold text-headline-lg text-primary">Reset your password</span>
          <p className="text-body-md text-on-surface-variant mt-2">Choose a new password below.</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
