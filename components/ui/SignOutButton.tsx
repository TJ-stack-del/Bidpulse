"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      title="Sign out"
      aria-label="Sign out"
      className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      <span className="material-symbols-outlined text-[22px]">logout</span>
    </button>
  );
}
