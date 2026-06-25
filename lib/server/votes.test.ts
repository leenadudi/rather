import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureAnonUser, rpc } = vi.hoisted(() => ({
  ensureAnonUser: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

import { castVote } from "@/lib/server/votes";

beforeEach(() => {
  ensureAnonUser.mockReset();
  rpc.mockReset();
  ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: true });
  rpc.mockResolvedValue({ data: [{ a: 2, b: 1, total: 3, pct_a: 67, pct_b: 33 }], error: null });
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
  it("derives the user server-side, calls rpc with p_* args, and returns counts", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "A");
    expect(ensureAnonUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("cast_vote", {
      p_question_id: "11111111-1111-1111-1111-111111111111",
      p_choice: "A",
      p_user_id: "u1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.total).toBe(3);
  });
});
