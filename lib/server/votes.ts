"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, voteSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";
import type { VoteCounts } from "@/types";

export async function castVote(questionId: string, choice: "A" | "B"): Promise<ActionResult<VoteCounts>> {
  return run(async () => {
    const input = parseOrThrow(voteSchema, { questionId, choice });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();

    const { data, error } = await db.rpc("cast_vote", {
      p_question_id: input.questionId,
      p_choice: input.choice,
      p_user_id: user.id,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { a: number; b: number; total: number; pct_a: number; pct_b: number };
    return { a: row.a, b: row.b, total: row.total, pct_a: row.pct_a, pct_b: row.pct_b };
  });
}
