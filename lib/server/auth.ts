import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { ActionError } from "@/lib/server/result";

export type SessionUser = { id: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id };
}

export async function requireAccount(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ActionError("account_required", "you need an account to do that");
  }
  return user;
}
