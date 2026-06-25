import { supabase } from "./supabase";
import type { Choice, VoteCounts } from "@/types";

export async function getMyVote(
  questionId: string,
  userId: string
): Promise<Choice | null> {
  const { data } = await supabase
    .from("votes")
    .select("choice")
    .eq("question_id", questionId)
    .eq("user_id", userId)
    .limit(1)
    .single();
  return (data?.choice as Choice) ?? null;
}

export async function getVoteCounts(questionId: string): Promise<VoteCounts> {
  const { data } = await supabase
    .from("votes")
    .select("choice")
    .eq("question_id", questionId);

  const counts = { a: 0, b: 0 };
  for (const row of data ?? []) {
    if (row.choice === "A") counts.a++;
    else counts.b++;
  }
  const total = counts.a + counts.b;
  return {
    ...counts,
    total,
    pct_a: total === 0 ? 50 : Math.round((counts.a / total) * 100),
    pct_b: total === 0 ? 50 : Math.round((counts.b / total) * 100),
  };
}
