import { startSession } from "@/lib/server/session";

// Returns the current anon/real user id, asking the SERVER to establish the
// session (so the browser never mints a competing anonymous identity). The
// cookie the server sets is shared with the cookie-based browser client.
export async function ensureSession(): Promise<string> {
  const res = await startSession();
  if (!res.ok) throw new Error("auth failed: " + res.error);
  return res.data.userId;
}
