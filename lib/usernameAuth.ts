// Supabase Auth has no username-only login — accounts are keyed on email. So a
// username maps to a synthetic, never-emailed address; the real username lives in
// the `users` table. Deterministic, so signing in needs no lookup.
export const USERNAME_EMAIL_DOMAIN = "users.rather.app";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
