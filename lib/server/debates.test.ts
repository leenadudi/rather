import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureAnonUser = vi.hoisted(() => vi.fn());
const state: { debateRow: Record<string, unknown> | null; inserted: Record<string, unknown> | null } = { debateRow: null, inserted: null };

vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ not: () => ({ limit: () => ({ single: async () => ({ data: null }) }) }) }),
          single: async () => ({ data: state.debateRow }),
        }),
      }),
      insert: (row: Record<string, unknown>) => { state.inserted = row; return { select: () => ({ single: async () => ({ data: { id: "d1" }, error: null }) }) }; },
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: "d1" }, error: null }) }) }) }),
    }),
  }),
}));

import { sendDebateMessage } from "@/lib/server/debates";

beforeEach(() => { ensureAnonUser.mockReset(); state.debateRow = null; state.inserted = null; ensureAnonUser.mockResolvedValue({ id: "ua", isAnonymous: false }); });

describe("sendDebateMessage", () => {
  it("rejects a non-participant", async () => {
    state.debateRow = { id: "d1", user_a_id: "someone", user_b_id: "other" };
    const r = await sendDebateMessage("33333333-3333-3333-3333-333333333333", "hello");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_participant");
  });
  it("sends as side A when the caller is user_a", async () => {
    state.debateRow = { id: "d1", user_a_id: "ua", user_b_id: "ub" };
    const r = await sendDebateMessage("33333333-3333-3333-3333-333333333333", "hello");
    expect(r.ok).toBe(true);
    expect(state.inserted).toMatchObject({ sender_side: "A", content: "hello" });
  });
});
