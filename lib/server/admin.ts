"use server";

import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";

export async function adminCreateQuestion(input: {
  optionA: string; optionB: string; dimension: string | null; debateEnabled: boolean; publishedAt: string;
}): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    if (!input.optionA?.trim() || !input.optionB?.trim()) throw new ActionError("invalid_input", "both options are required");
    const db = createServiceSupabase();
    const { data, error } = await db.from("questions").insert({
      option_a: input.optionA.trim(),
      option_b: input.optionB.trim(),
      dimension: input.dimension,
      debate_enabled: input.debateEnabled,
      published_at: input.publishedAt,
      type: "daily",
    }).select().single();
    if (error) throw error;
    return { id: (data as { id: string }).id };
  });
}

export async function adminDeleteQuestion(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const db = createServiceSupabase();
    const { error } = await db.from("questions").delete().eq("id", id);
    if (error) throw error;
    return null;
  });
}

export async function adminSetQuestionStatus(id: string, status: "approved" | "hidden"): Promise<ActionResult<null>> {
  return run(async () => {
    if (status !== "approved" && status !== "hidden") throw new ActionError("invalid_input", "bad status");
    const db = createServiceSupabase();
    const { error } = await db.from("questions").update({ status }).eq("id", id);
    if (error) throw error;
    return null;
  });
}
