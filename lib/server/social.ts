"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, friendRequestSchema, respondRequestSchema, predictionSchema } from "@/lib/server/validation";

export async function sendFriendRequest(toId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(friendRequestSchema, { toId });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { error } = await db.from("friend_requests").insert({ from_user_id: user.id, to_user_id: input.toId, status: "pending" });
    if (error) throw error;
    return null;
  });
}

export async function respondToFriendRequest(requestId: string, accept: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(respondRequestSchema, { requestId, accept });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { data } = await db.from("friend_requests").select("to_user_id").eq("id", input.requestId).single();
    if (!data || (data as { to_user_id: string }).to_user_id !== user.id) {
      throw new ActionError("not_authorized", "you cannot respond to this request");
    }
    await db.from("friend_requests").update({ status: input.accept ? "accepted" : "declined" }).eq("id", input.requestId);
    return null;
  });
}

export async function makePrediction(targetId: string, questionId: string, choice: "A" | "B"): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(predictionSchema, { targetId, questionId, choice });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { error } = await db.from("predictions").upsert(
      { predictor_id: user.id, target_id: input.targetId, question_id: input.questionId, predicted_choice: input.choice },
      { onConflict: "predictor_id,target_id,question_id" }
    );
    if (error) throw error;
    return null;
  });
}
