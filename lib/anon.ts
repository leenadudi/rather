import { supabase } from "./supabase";

// Returns a Supabase user ID — creates an anonymous session if none exists.
// Anonymous sessions persist in localStorage, so the user keeps their data
// across page loads on the same device until they create a permanent account.
export async function ensureSession(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error("auth failed: " + error?.message);
  return data.user.id;
}
