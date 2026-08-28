import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Supabase projects created after the 2025 API key rework expose a
    // "publishable" key instead of the legacy "anon" key — support both
    // names so setup works regardless of which one the dashboard showed.
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
  );
}
