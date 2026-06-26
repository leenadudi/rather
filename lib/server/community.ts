"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, communitySubmitSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";
import { checkRateLimit } from "@/lib/server/ratelimit";

export async function submitCommunityQuestion(optionA: string, optionB: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const input = parseOrThrow(communitySubmitSchema, { optionA, optionB });
    const user = await requireAccount();
    await checkRateLimit(user.id, "community_submit", 5, 3600);
    const db = createServiceSupabase();
    const { data, error } = await db
      .from("questions")
      .insert({
        option_a: input.optionA,
        option_b: input.optionB,
        type: "community",
        author_id: user.id,
        debate_enabled: false,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return { id: (data as { id: string }).id };
  });
}
