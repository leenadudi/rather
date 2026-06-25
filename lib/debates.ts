import { supabase } from "./supabase";
import type { Choice, Debate, DebateMessage } from "@/types";

export async function joinDebateQueue(
  questionId: string,
  side: Choice,
  userId: string
): Promise<{ debate: Debate; matched: boolean }> {
  const opposite: Choice = side === "A" ? "B" : "A";
  const waitingCol = opposite === "A" ? "user_a_id" : "user_b_id";

  const { data: waiting } = await supabase
    .from("debates")
    .select("*")
    .eq("question_id", questionId)
    .eq("status", "waiting")
    .not(waitingCol, "is", null)
    .limit(1)
    .single();

  if (waiting) {
    const myCol = side === "A" ? "user_a_id" : "user_b_id";
    const { data: matched } = await supabase
      .from("debates")
      .update({
        [myCol]: userId,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .eq("id", waiting.id)
      .select()
      .single();
    return { debate: matched as Debate, matched: true };
  }

  const myCol = side === "A" ? "user_a_id" : "user_b_id";
  const { data: created } = await supabase
    .from("debates")
    .insert({
      question_id: questionId,
      [myCol]: userId,
      status: "waiting",
    })
    .select()
    .single();
  return { debate: created as Debate, matched: false };
}

export async function sendDebateMessage(
  debateId: string,
  senderSide: Choice,
  content: string
): Promise<DebateMessage | null> {
  const { data, error } = await supabase
    .from("debate_messages")
    .insert({ debate_id: debateId, sender_side: senderSide, content })
    .select()
    .single();
  if (error) return null;
  return data as DebateMessage;
}

export async function getDebateMessages(debateId: string): Promise<DebateMessage[]> {
  const { data } = await supabase
    .from("debate_messages")
    .select("*")
    .eq("debate_id", debateId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DebateMessage[];
}

export async function endDebate(debateId: string, status: "ended" | "flagged" = "ended") {
  await supabase
    .from("debates")
    .update({ status, ended_at: new Date().toISOString() })
    .eq("id", debateId);
}

export async function getQueueCounts(questionId: string): Promise<{ a: number; b: number }> {
  const { data } = await supabase
    .from("debates")
    .select("user_a_id, user_b_id")
    .eq("question_id", questionId)
    .eq("status", "waiting");

  let a = 0, b = 0;
  for (const row of data ?? []) {
    if (row.user_a_id) a++;
    if (row.user_b_id) b++;
  }
  return { a, b };
}

export async function flagDebateMessage(messageId: string, debateId: string) {
  await supabase
    .from("debate_messages")
    .update({ flagged: true })
    .eq("id", messageId);

  const { data: debate } = await supabase
    .from("debates")
    .select("flag_count")
    .eq("id", debateId)
    .single();

  const newCount = (debate?.flag_count ?? 0) + 1;
  await supabase
    .from("debates")
    .update({ flag_count: newCount })
    .eq("id", debateId);

  if (newCount >= 2) {
    await endDebate(debateId, "flagged");
  }
  return newCount;
}
