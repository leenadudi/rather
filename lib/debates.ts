import { supabase } from "./supabase";
import type { DebateMessage } from "@/types";

export async function getDebateMessages(debateId: string): Promise<DebateMessage[]> {
  const { data } = await supabase
    .from("debate_messages")
    .select("*")
    .eq("debate_id", debateId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DebateMessage[];
}

export async function getQueueCounts(questionId: string): Promise<{ a: number; b: number }> {
  const freshSince = new Date(Date.now() - 30_000).toISOString();
  const { data } = await supabase
    .from("debates")
    .select("user_a_id, user_b_id")
    .eq("question_id", questionId)
    .eq("status", "waiting")
    .gt("last_seen_at", freshSince);

  let a = 0, b = 0;
  for (const row of data ?? []) {
    if (row.user_a_id) a++;
    if (row.user_b_id) b++;
  }
  return { a, b };
}

