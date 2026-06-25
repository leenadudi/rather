"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, usernameSchema } from "@/lib/server/validation";

export async function setUsername(username: string): Promise<ActionResult<{ username: string }>> {
  return run(async () => {
    const input = parseOrThrow(usernameSchema, { username });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { error } = await db.from("users").upsert({ id: user.id, username: input.username }, { onConflict: "id" });
    if (error) {
      if (error.code === "23505") throw new ActionError("username_taken", "that username is taken — try another");
      throw error;
    }
    return { username: input.username };
  });
}
