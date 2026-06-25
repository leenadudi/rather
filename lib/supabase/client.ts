import { createBrowserClient } from "@supabase/ssr";

// Browser client: anon key, used ONLY for reads and realtime subscriptions.
// All writes go through server actions (see lib/server/*).
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
