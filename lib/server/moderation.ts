"use server";

import { requireAccount } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import type { ActionResult } from "@/lib/server/result";
import { parseOrThrow, reportSchema } from "@/lib/server/validation";

const HIDE_THRESHOLD = 3;

export async function reportContent(
  targetType: "question" | "comment",
  targetId: string,
  reason?: string
): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(reportSchema, { targetType, targetId, reason });
    const user = await requireAccount();
    await checkRateLimit(user.id, "report", 10, 3600);
    const db = createServiceSupabase();

    await db.from("reports").upsert(
      {
        reporter_id: user.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason ?? null,
      },
      { onConflict: "reporter_id,target_type,target_id", ignoreDuplicates: true }
    );

    if (input.targetType === "question") {
      const { count } = await db
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "question")
        .eq("target_id", input.targetId);
      if ((count ?? 0) >= HIDE_THRESHOLD) {
        await db.from("questions").update({ status: "hidden" }).eq("id", input.targetId);
      }
    }
    return null;
  });
}
