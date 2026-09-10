import { NextRequest, NextResponse } from "next/server";
import { isTrustedOutboxSchedulerToken } from "@/lib/auth/github-actions-oidc";
import { processStageEmailOutbox } from "@/lib/email/stage-outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!token) return false;

  const expected = process.env.CRON_SECRET;
  if (expected && token === expected) return true;

  return isTrustedOutboxSchedulerToken(token);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processStageEmailOutbox({ limit: 50 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[process-stage-email-outbox] failed", error);
    return NextResponse.json(
      { error: "Could not process the stage email outbox." },
      { status: 500 }
    );
  }
}
