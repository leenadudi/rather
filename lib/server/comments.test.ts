import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionError } from "@/lib/server/result";

const { requireAccount, insert, rpc, checkRateLimit } = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/ratelimit", () => ({ checkRateLimit }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }) };
      },
    }),
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

import { postComment, likeComment } from "@/lib/server/comments";

beforeEach(() => {
  [requireAccount, insert, rpc, checkRateLimit].forEach((m) => m.mockReset());
  requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false });
  rpc.mockResolvedValue({ error: null });
  checkRateLimit.mockResolvedValue(undefined);
});

describe("postComment", () => {
  it("rejects empty content without writing", async () => {
    const r = await postComment("11111111-1111-1111-1111-111111111111", "   ", "A");
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
  it("writes a valid comment with the server-derived user", async () => {
    const r = await postComment("11111111-1111-1111-1111-111111111111", "hi", "A");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ content: "hi", user_id: "u1", choice: "A" }));
    expect(r.ok).toBe(true);
  });
  it("returns account_required and performs no write when requireAccount rejects", async () => {
    requireAccount.mockRejectedValue(new ActionError("account_required", "you need an account to do that"));
    const r = await postComment("11111111-1111-1111-1111-111111111111", "hi", "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
    expect(insert).not.toHaveBeenCalled();
  });
  it("returns rate_limited and performs no insert when checkRateLimit throws", async () => {
    checkRateLimit.mockRejectedValue(new ActionError("rate_limited", "you're doing that too fast — give it a moment"));
    const r = await postComment("11111111-1111-1111-1111-111111111111", "hi", "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("rate_limited");
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("likeComment", () => {
  it("rejects an invalid commentId without calling rpc", async () => {
    const r = await likeComment("not-a-uuid");
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("calls rpc with like_comment and p_* args", async () => {
    const r = await likeComment("22222222-2222-2222-2222-222222222222");
    expect(rpc).toHaveBeenCalledWith("like_comment", {
      p_comment_id: "22222222-2222-2222-2222-222222222222",
      p_user_id: "u1",
    });
    expect(r.ok).toBe(true);
  });
});
