import { supabase } from "./supabase";
import type { Choice, Vote, VoteCounts } from "@/types";

export async function castVote(
  questionId: string,
  choice: Choice,
  deviceId: string,
  userId?: string
): Promise<{ vote: Vote | null; error: string | null }> {
  const payload: Record<string, unknown> = {
    question_id: questionId,
    choice,
    device_id: userId ? null : deviceId,
    user_id: userId ?? null,
  };

  const { data, error } = await supabase
    .from("votes")
    .upsert(payload, {
      onConflict: userId ? "question_id,user_id" : "question_id,device_id",
      ignoreDuplicates: true,
    })
    .select()
    .single();

  if (error && error.code !== "23505") {
    return { vote: null, error: error.message };
  }
  return { vote: data as Vote, error: null };
}

export async function getMyVote(
  questionId: string,
  deviceId: string,
  userId?: string
): Promise<Choice | null> {
  let query = supabase
    .from("votes")
    .select("choice")
    .eq("question_id", questionId)
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("device_id", deviceId);
  }

  const { data } = await query.single();
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
