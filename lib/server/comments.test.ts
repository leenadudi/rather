import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureAnonUser, insert, likeInsert, rpc } = vi.hoisted(() => ({
  ensureAnonUser: vi.fn(),
  insert: vi.fn(),
  likeInsert: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        if (table === "comment_likes") { likeInsert(row); return { error: null }; }
        insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }) };
      },
    }),
    rpc: (...a: unknown[]) => { rpc(...a); return Promise.resolve({ error: null }); },
  }),
}));

import { postComment, likeComment } from "@/lib/server/comments";

beforeEach(() => { [ensureAnonUser, insert, likeInsert, rpc].forEach((m) => m.mockReset()); ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: false }); });

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
  it("inserts a like row and increments via rpc", async () => {
    const r = await likeComment("22222222-2222-2222-2222-222222222222");
    expect(likeInsert).toHaveBeenCalledWith(expect.objectContaining({ comment_id: "22222222-2222-2222-2222-222222222222", user_id: "u1" }));
    expect(rpc).toHaveBeenCalledWith("increment_comment_likes", { cid: "22222222-2222-2222-2222-222222222222" });
    expect(r.ok).toBe(true);
  });
});
