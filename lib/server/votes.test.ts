import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionUser, requireAccount, rpc } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requireAccount: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ getSessionUser, requireAccount }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

import { castVote, claimAnonymousVotes } from "@/lib/server/votes";

beforeEach(() => {
  getSessionUser.mockReset();
  requireAccount.mockReset();
  rpc.mockReset();
  getSessionUser.mockResolvedValue({ id: "u1" });
  requireAccount.mockResolvedValue({ id: "u1" });
  rpc.mockResolvedValue({ data: [{ vote_id: "v1", a: 2, b: 1, total: 3, pct_a: 67, pct_b: 33 }], error: null });
});

describe("castVote", () => {
  it("rejects an invalid choice without calling rpc", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "C" as "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_input");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a non-uuid question id without calling rpc", async () => {
    const r = await castVote("nope", "A");
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("ties the vote to the signed-in user, calls rpc with p_* args, and returns counts", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "A");
    expect(getSessionUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("cast_vote", {
      p_question_id: "11111111-1111-1111-1111-111111111111",
      p_choice: "A",
      p_user_id: "u1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.total).toBe(3); expect(r.data.voteId).toBe("v1"); }
  });
  it("casts an anonymous vote (p_user_id null) when there is no account", async () => {
    getSessionUser.mockResolvedValue(null);
    const r = await castVote("11111111-1111-1111-1111-111111111111", "B");
    expect(rpc).toHaveBeenCalledWith("cast_vote", {
      p_question_id: "11111111-1111-1111-1111-111111111111",
      p_choice: "B",
      p_user_id: null,
    });
    expect(r.ok).toBe(true);
  });
});

describe("claimAnonymousVotes", () => {
  it("claims each vote id for the signed-in user", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const r = await claimAnonymousVotes(["v1", "v2"]);
    expect(requireAccount).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("claim_vote", { p_vote_id: "v1", p_user_id: "u1" });
    expect(rpc).toHaveBeenCalledWith("claim_vote", { p_vote_id: "v2", p_user_id: "u1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.claimed).toBe(2);
  });
  it("is a no-op with no ids and never touches the db", async () => {
    const r = await claimAnonymousVotes([]);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.claimed).toBe(0);
  });
});
