"use server";

import { getSessionUser, requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, voteSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";
import type { VoteCounts } from "@/types";

// voteId lets a visitor's anonymous vote be claimed into an account later.
export type VoteResult = VoteCounts & { voteId: string | null };

export async function castVote(questionId: string, choice: "A" | "B"): Promise<ActionResult<VoteResult>> {
  return run(async () => {
    const input = parseOrThrow(voteSchema, { questionId, choice });
    // Voting is open to everyone. Signed-in users get their vote tied to them
    // (for streak/history); visitors vote anonymously (user_id = null), which
    // just accumulates toward the public tally.
    const user = await getSessionUser();
    const db = createServiceSupabase();

    const { data, error } = await db.rpc("cast_vote", {
      p_question_id: input.questionId,
      p_choice: input.choice,
      p_user_id: user?.id ?? null,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { vote_id: string | null; a: number; b: number; total: number; pct_a: number; pct_b: number };
    return { voteId: row.vote_id, a: row.a, b: row.b, total: row.total, pct_a: row.pct_a, pct_b: row.pct_b };
  });
}

// Reassign anonymous votes cast in this browser to the now-signed-in account, so
// the answers a visitor gave before signing up are saved to their account.
export async function claimAnonymousVotes(voteIds: string[]): Promise<ActionResult<{ claimed: number }>> {
  return run(async () => {
    const user = await requireAccount();
    const ids = voteIds.filter((id) => typeof id === "string" && id.length > 0).slice(0, 100);
    if (ids.length === 0) return { claimed: 0 };
    const db = createServiceSupabase();
    for (const id of ids) {
      const { error } = await db.rpc("claim_vote", { p_vote_id: id, p_user_id: user.id });
      if (error) throw error;
    }
    return { claimed: ids.length };
  });
}
