import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureAnonUser, upsert, selectEq } = vi.hoisted(() => ({
  ensureAnonUser: vi.fn(),
  upsert: vi.fn(),
  selectEq: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: () => ({
      upsert: (...a: unknown[]) => { upsert(...a); return { select: () => ({ single: async () => ({ data: {}, error: null }) }) }; },
      select: () => ({ eq: (...a: unknown[]) => { selectEq(...a); return { then: undefined, data: [{ choice: "A" }, { choice: "B" }, { choice: "A" }] }; } }),
    }),
  }),
}));

import { castVote } from "@/lib/server/votes";

beforeEach(() => { ensureAnonUser.mockReset(); upsert.mockReset(); selectEq.mockReset(); ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: true }); });

describe("castVote", () => {
  it("rejects an invalid choice without writing", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "C" as "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_input");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects a non-uuid question id", async () => {
    const r = await castVote("nope", "A");
    expect(r.ok).toBe(false);
  });
  it("derives the user server-side and returns counts on success", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "A");
    expect(ensureAnonUser).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalled();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.total).toBe(3);
  });
});
