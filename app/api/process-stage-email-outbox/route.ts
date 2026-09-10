import { NextRequest, NextResponse } from "next/server";
import { processStageEmailOutbox } from "@/lib/email/stage-outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
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
