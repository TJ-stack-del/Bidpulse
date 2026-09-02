import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// App-level substitute for Supabase Auth's native inactivity-timeout
// setting — that's a real feature but gated behind Supabase's Pro plan,
// which this project isn't on. Sessions otherwise never expire from
// inactivity at all (the Supabase Auth default), which is a real gap
// given client data includes insurance policy numbers, license numbers,
// and uploaded RFP files. Mike's chosen value: 14 days.
//
// Tracked via a plain "last seen" cookie rather than anything in the JWT
// (Supabase's own session lifetime is about total session age, not time
// since last activity) — a sliding window, renewed on every authenticated
// request. Once a signed-in visitor goes 14 days without a single
// request, the next one they make signs them out server-side and sends
// them to /login, instead of silently refreshing forever.
const INACTIVITY_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;
const LAST_ACTIVE_COOKIE = "bp_last_active";

// Runs on every request. Refreshes the Supabase auth session and keeps
// the browser's session cookie in sync — without this, users get logged
// out unexpectedly and server components can't reliably read auth.uid().
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // See lib/supabase/client.ts — support both the legacy anon key name
    // and the newer publishable key name.
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually triggers the token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const lastActiveRaw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value;
    const lastActive = lastActiveRaw ? Number(lastActiveRaw) : null;
    const now = Date.now();

    if (lastActive && now - lastActive > INACTIVITY_TIMEOUT_MS) {
      await supabase.auth.signOut();
      const redirectResponse = NextResponse.redirect(new URL("/login?reason=inactive", request.url));
      redirectResponse.cookies.delete(LAST_ACTIVE_COOKIE);
      return redirectResponse;
    }

    response.cookies.set(LAST_ACTIVE_COOKIE, String(now), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: INACTIVITY_TIMEOUT_MS / 1000,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
