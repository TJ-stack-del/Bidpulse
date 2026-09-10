import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "https://bidpulse.co/api/process-stage-email-outbox";
const REPOSITORY = "TJ-stack-del/Bidpulse";
const REF = "refs/heads/main";
const WORKFLOW_REF =
  "TJ-stack-del/Bidpulse/.github/workflows/process-stage-email-outbox.yml@refs/heads/main";
const ALLOWED_EVENTS = new Set(["schedule", "workflow_dispatch"]);

const githubKeys = createRemoteJWKSet(
  new URL(`${ISSUER}/.well-known/jwks`)
);

export async function isTrustedOutboxSchedulerToken(
  token: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, githubKeys, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return (
      payload.repository === REPOSITORY &&
      payload.ref === REF &&
      payload.workflow_ref === WORKFLOW_REF &&
      typeof payload.event_name === "string" &&
      ALLOWED_EVENTS.has(payload.event_name)
    );
  } catch {
    return false;
  }
}

