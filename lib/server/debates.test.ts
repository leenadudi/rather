import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionError } from "@/lib/server/result";

const requireAccount = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const state: { debateRow: Record<string, unknown> | null; inserted: Record<string, unknown> | null } = { debateRow: null, inserted: null };

vi.mock("@/lib/server/auth", () => ({ requireAccount }));
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
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

import { joinDebateQueue, sendDebateMessage } from "@/lib/server/debates";

beforeEach(() => {
  requireAccount.mockReset();
  rpc.mockReset();
  state.debateRow = null;
  state.inserted = null;
  requireAccount.mockResolvedValue({ id: "ua", isAnonymous: false });
  rpc.mockResolvedValue({ data: [{ debate_id: "d1", matched: true }], error: null });
});

describe("joinDebateQueue", () => {
  it("rejects an invalid side without calling rpc", async () => {
    const r = await joinDebateQueue("11111111-1111-1111-1111-111111111111", "C" as "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_input");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a non-uuid question id without calling rpc", async () => {
    const r = await joinDebateQueue("nope", "A");
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("calls rpc with join_debate + p_* args and returns debateId and matched", async () => {
    const r = await joinDebateQueue("11111111-1111-1111-1111-111111111111", "A");
    expect(rpc).toHaveBeenCalledWith("join_debate", {
      p_question_id: "11111111-1111-1111-1111-111111111111",
      p_side: "A",
      p_user_id: "ua",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.debateId).toBe("d1");
      expect(r.data.matched).toBe(true);
    }
  });
  it("returns account_required and performs no rpc call when requireAccount rejects", async () => {
    requireAccount.mockRejectedValue(new ActionError("account_required", "you need an account to do that"));
    const r = await joinDebateQueue("11111111-1111-1111-1111-111111111111", "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
    expect(rpc).not.toHaveBeenCalled();
  });
});

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
