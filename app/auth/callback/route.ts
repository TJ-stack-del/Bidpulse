import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Supabase's callback for both the passwordless magic-link path
// (LoginForm's signInWithOtp) and the password-recovery path
// (LoginForm's resetPasswordForEmail) — either emailed link points here.
//
// Two different URL shapes are both real and both need handling, not just
// the `code` one: which shape Supabase actually sends depends on the
// auth flow type and the exact email template configured in the
// dashboard, not just on this app's own code. A PKCE flow appends
// `?code=...`, exchanged via exchangeCodeForSession — but that exchange
// depends on a code_verifier stored client-side when the request was
// first made, which is only present if the link is opened in the *same*
// browser/device, not just the same account. An OTP-hash flow instead
// appends `?token_hash=...&type=recovery` (or `type=magiclink`), verified
// via verifyOtp — no stored client secret required, so it works
// regardless of which device/browser opens the email. Handling both means
// this works no matter which one Supabase's current template/flow
// setting actually produces.
//
// Previously, a failed exchangeCodeForSession() was silently swallowed —
// the redirect to `next` happened unconditionally either way, so a real
// user hitting this exact code_verifier mismatch landed on
// /reset-password with no session and no way to tell why. Logging the
// real error here is the difference between "reproduce a live bug blind"
// and actually knowing what failed.
// Behind a reverse proxy (GitHub Codespaces' own port-forwarding for
// dev/testing, and Vercel's edge network in production), the raw
// request.url this route handler sees doesn't reliably reflect the
// public-facing address the browser actually used — a real, reproduced
// bug: a Codespace-forwarded request came back with an origin of
// `https://<name>-3000.app.github.dev:3000` (a literal, invalid `:3000`
// appended after a hostname that already encodes the port in its own
// `-3000` prefix), which no DNS/routing actually resolves to, producing
// a real "page can't be found" for a real user. Standard fix: prefer the
// `x-forwarded-host`/`x-forwarded-proto` headers a well-behaved proxy
// sets to the real public host/scheme, falling back to the request's own
// derived origin only when neither header is present (e.g. a direct
// request with no proxy in front at all).
function resolveOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return fallbackOrigin;
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
}

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url);
  const origin = resolveOrigin(request, rawOrigin);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", {
        message: error.message,
        status: error.status,
        next,
      });
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("[auth/callback] verifyOtp failed", { message: error.message, status: error.status, type, next });
    }
  } else if (searchParams.get("error")) {
    // Supabase's own /verify endpoint redirects here with error/
    // error_description params (not a code or token_hash at all) when the
    // link itself is already expired or was already used — real signal,
    // not silently absent either.
    console.error("[auth/callback] Supabase redirected with an error", {
      error: searchParams.get("error"),
      error_description: searchParams.get("error_description"),
      next,
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
