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

    await db
      .from("votes")
      .upsert(
        { question_id: input.questionId, choice: input.choice, user_id: user.id },
        { onConflict: "question_id,user_id", ignoreDuplicates: true }
      );

    const { data } = await db.from("votes").select("choice").eq("question_id", input.questionId);
    let a = 0, b = 0;
    for (const row of data ?? []) { if (row.choice === "A") a++; else b++; }
    const total = a + b;
    return {
      a, b, total,
      pct_a: total === 0 ? 50 : Math.round((a / total) * 100),
      pct_b: total === 0 ? 50 : Math.round((b / total) * 100),
    };
  });
}
