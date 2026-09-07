"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";

// Closes BUILD-ORDER-BIDPULSE.md item #10: before this, is_test could only
// ever be set via a direct database edit — nothing in the app wrote it,
// including the intake wizard. This is deliberately a plain admin-facing
// toggle on an existing, real, actively-used column (drives admin inbox
// ordering, digest emails, and reporting exclusions elsewhere in the app),
// not a new concept — same "admins manage submissions" RLS policy already
// covers this column, no migration needed.
export function IsTestToggle({
  submissionId,
  initialValue,
}: {
  submissionId: string;
  initialValue: boolean;
}) {
  const router = useRouter();
  const [isTest, setIsTest] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  async function handleToggle() {
    const next = !isTest;
    setSaving(true);
    const { error } = await supabase.from("submissions").update({ is_test: next }).eq("id", submissionId);
    setSaving(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }
    setIsTest(next);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 mt-2 text-label-md text-on-surface-variant cursor-pointer select-none w-fit">
      <input
        type="checkbox"
        checked={isTest}
        disabled={saving}
        onChange={handleToggle}
        className="accent-secondary"
      />
      <span className={isTest ? "text-error font-bold" : ""}>
        {isTest ? "TEST — excluded from revenue reporting" : "Mark as test submission"}
      </span>
      {saving && <Spinner />}
    </label>
  );
}
