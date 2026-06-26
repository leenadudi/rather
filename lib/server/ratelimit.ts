import "server-only";
import { createServiceSupabase } from "@/lib/server/supabase";
import { ActionError } from "@/lib/server/result";

// Atomic fixed-window rate limit. Throws ActionError("rate_limited") when the
// caller exceeds `limit` writes of `action` within `windowSeconds`. Fails OPEN
// if the DB function isn't installed yet (so the app works before migration 007).
export async function checkRateLimit(
  userId: string, action: string, limit: number, windowSeconds: number
): Promise<void> {
  const db = createServiceSupabase();
  const { data, error } = await db.rpc("check_rate_limit", {
    p_user_id: userId, p_action: action, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) {
    if ((error as { code?: string }).code === "42883") return; // function missing → allow
    throw error;
  }
  if (data === false) {
    throw new ActionError("rate_limited", "you're doing that too fast — give it a moment");
  }
}
