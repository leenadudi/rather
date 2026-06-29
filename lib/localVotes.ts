import type { Choice } from "@/types";

// Visitors without an account have no user_id, so their vote can't be looked up
// server-side. We remember the choice in this browser (so returning visitors see
// their pick + results) along with the vote's row id, so the answer can be
// "claimed" into their account if they sign up later.
const PREFIX = "rather:vote:";
const key = (questionId: string) => `${PREFIX}${questionId}`;

type Stored = { choice: Choice; voteId: string | null };

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  // Back-compat: an older format stored just "A"/"B".
  if (raw === "A" || raw === "B") return { choice: raw, voteId: null };
  try {
    const v = JSON.parse(raw) as Stored;
    return v.choice === "A" || v.choice === "B" ? v : null;
  } catch {
    return null;
  }
}

export function readLocalVote(questionId: string): Choice | null {
  if (typeof window === "undefined") return null;
  try {
    return parse(window.localStorage.getItem(key(questionId)))?.choice ?? null;
  } catch {
    return null;
  }
}

export function writeLocalVote(questionId: string, choice: Choice, voteId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(questionId), JSON.stringify({ choice, voteId }));
  } catch {
    // ignore (private mode / storage disabled)
  }
}

// Every remembered anonymous vote that still has a row id to claim.
export function pendingClaims(): { questionId: string; voteId: string }[] {
  if (typeof window === "undefined") return [];
  const out: { questionId: string; voteId: string }[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const v = parse(window.localStorage.getItem(k));
      if (v?.voteId) out.push({ questionId: k.slice(PREFIX.length), voteId: v.voteId });
    }
  } catch {
    // ignore
  }
  return out;
}

// After a successful claim the row is no longer anonymous — drop its id so we
// don't try to claim it again (keep the choice for local display).
export function markClaimed(questionId: string): void {
  if (typeof window === "undefined") return;
  const choice = readLocalVote(questionId);
  if (choice) writeLocalVote(questionId, choice, null);
}
