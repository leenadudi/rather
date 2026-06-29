"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, usernameSchema } from "@/lib/server/validation";
import { isHexColor } from "@/lib/avatar";

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

export async function setAvatarColor(color: string): Promise<ActionResult<{ color: string }>> {
  return run(async () => {
    const normalized = color.trim().toLowerCase();
    if (!isHexColor(normalized)) throw new ActionError("invalid_input", "that isn't a valid color");
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { error } = await db.from("users").update({ avatar_color: normalized }).eq("id", user.id);
    if (error) throw error;
    return { color: normalized };
  });
}

export async function deleteAccount(): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await requireAccount();
    const db = createServiceSupabase();
    // Removing the auth user cascades the profile row (and friends/predictions);
    // their votes/comments are kept but de-identified (user_id set null by FK).
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return null;
  });
}
