import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureAnonUser, insert, rpc } = vi.hoisted(() => ({
  ensureAnonUser: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
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
  [ensureAnonUser, insert, rpc].forEach((m) => m.mockReset());
  ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: false });
  rpc.mockResolvedValue({ error: null });
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
