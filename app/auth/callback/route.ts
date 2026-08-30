import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's standard PKCE callback for a magic-link sign-in
// (LoginForm's passwordless email path) — the emailed link points here
// with a `code` param; exchanging it sets the real session cookie, then
// app/page.tsx's own root routing sends the now-signed-in user to the
// right place (client dashboard vs admin inbox).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
