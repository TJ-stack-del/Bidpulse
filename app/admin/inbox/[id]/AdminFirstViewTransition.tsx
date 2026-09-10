"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function AdminFirstViewTransition({
  submissionId,
  initialStage,
}: {
  submissionId: string;
  initialStage: string;
}) {
  const attempted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (initialStage !== "submitted" || attempted.current) return;
    attempted.current = true;

    void fetch(`/api/admin/submissions/${submissionId}/transition-stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedStage: "submitted",
        newStage: "in_review",
        trigger: "admin_first_view",
      }),
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (
          response.status === 409 ||
          result?.applied ||
          (typeof result?.currentStage === "string" &&
            result.currentStage !== initialStage)
        ) {
          router.refresh();
          return;
        }
        console.error("[admin-first-view] transition failed", result?.error);
      })
      .catch((error) => {
        console.error("[admin-first-view] transition failed", error);
      });
  }, [initialStage, router, submissionId]);

  return null;
}
