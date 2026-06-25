"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { run } from "@/lib/server/run";
import type { ActionResult } from "@/lib/server/result";

// The single server-authoritative entrypoint for anonymous identity. The client
// calls this (via lib/anon.ts) instead of minting its own session, so the
// browser and server never create competing anonymous users.
export async function startSession(): Promise<ActionResult<{ userId: string }>> {
  return run(async () => {
    const user = await ensureAnonUser();
    return { userId: user.id };
  });
}
