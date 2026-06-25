import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { ActionError } from "@/lib/server/result";

export type SessionUser = { id: string; isAnonymous: boolean };

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, isAnonymous: data.user.is_anonymous ?? false };
}

export async function requireAccount(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) {
    throw new ActionError("account_required", "you need an account to do that");
  }
  return user;
}

export async function ensureAnonUser(): Promise<SessionUser> {
  const existing = await getSessionUser();
  if (existing) return existing;

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new ActionError("auth_failed", "could not start a session");
  }
  return { id: data.user.id, isAnonymous: true };
}
