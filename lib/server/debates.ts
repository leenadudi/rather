"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, joinDebateSchema, debateMessageSchema, heartbeatSchema } from "@/lib/server/validation";
import { checkRateLimit } from "@/lib/server/ratelimit";

export async function joinDebateQueue(questionId: string, side: "A" | "B"): Promise<ActionResult<{ debateId: string; matched: boolean }>> {
  return run(async () => {
    const input = parseOrThrow(joinDebateSchema, { questionId, side });
    const user = await requireAccount();
    const db = createServiceSupabase();
    // Must have voted this side before debating it.
    const { data: vote } = await db
      .from("votes")
      .select("id")
      .eq("question_id", input.questionId)
      .eq("user_id", user.id)
      .eq("choice", input.side)
      .maybeSingle();
    if (!vote) throw new ActionError("not_voted", "vote on this question before debating");
    const { data, error } = await db.rpc("join_debate", {
      p_question_id: input.questionId,
      p_side: input.side,
      p_user_id: user.id,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { debate_id: string; matched: boolean };
    return { debateId: row.debate_id, matched: row.matched };
  });
}

async function loadParticipantSide(db: ReturnType<typeof createServiceSupabase>, debateId: string, userId: string): Promise<"A" | "B"> {
  const { data } = await db.from("debates").select("user_a_id, user_b_id").eq("id", debateId).single();
  const row = data as { user_a_id: string | null; user_b_id: string | null } | null;
  if (row?.user_a_id === userId) return "A";
  if (row?.user_b_id === userId) return "B";
  throw new ActionError("not_participant", "you are not part of this debate");
}

export async function sendDebateMessage(debateId: string, content: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(debateMessageSchema, { debateId, content });
    const user = await requireAccount();
    await checkRateLimit(user.id, "debate_msg", 30, 60);
    const db = createServiceSupabase();
    const side = await loadParticipantSide(db, input.debateId, user.id);
    await db.from("debate_messages").insert({ debate_id: input.debateId, sender_side: side, content: input.content });
    return null;
  });
}

export async function endDebate(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await requireAccount();
    const db = createServiceSupabase();
    await loadParticipantSide(db, debateId, user.id); // throws if not a participant
    await db.from("debates").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", debateId);
    return null;
  });
}

export async function flagDebateMessage(messageId: string, debateId: string): Promise<ActionResult<{ flagCount: number }>> {
  return run(async () => {
    const user = await requireAccount();
    const db = createServiceSupabase();
    await loadParticipantSide(db, debateId, user.id);
    await db.from("debate_messages").update({ flagged: true }).eq("id", messageId);
    const { data } = await db.from("debates").select("flag_count").eq("id", debateId).single();
    const newCount = ((data as { flag_count: number } | null)?.flag_count ?? 0) + 1;
    await db.from("debates").update({ flag_count: newCount }).eq("id", debateId);
    if (newCount >= 2) {
      await db.from("debates").update({ status: "flagged", ended_at: new Date().toISOString() }).eq("id", debateId);
    }
    return { flagCount: newCount };
  });
}

export async function cancelQueue(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await requireAccount();
    const db = createServiceSupabase();
    await loadParticipantSide(db, debateId, user.id);
    await db.from("debates").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", debateId);
    return null;
  });
}

export async function heartbeatQueue(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(heartbeatSchema, { debateId });
    const user = await requireAccount();
    const db = createServiceSupabase();
    await loadParticipantSide(db, input.debateId, user.id); // throws not_participant
    await db.from("debates")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", input.debateId)
      .eq("status", "waiting"); // no-op once matched/ended
    return null;
  });
}
