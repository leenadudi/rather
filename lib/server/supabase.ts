import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. NEVER import this into client code.
// Used by server actions to perform validated writes.
export function createServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY — service role client unavailable");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
