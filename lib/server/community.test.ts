import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureAnonUser, insert } = vi.hoisted(() => ({
  ensureAnonUser: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "q1" }, error: null }) }) };
      },
    }),
  }),
}));

import { submitCommunityQuestion } from "@/lib/server/community";

beforeEach(() => {
  ensureAnonUser.mockReset();
  insert.mockReset();
  ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: false });
});

describe("submitCommunityQuestion", () => {
  it("rejects too-short options without writing", async () => {
    const r = await submitCommunityQuestion("a", "b");
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
  it("writes a community question authored by the server-derived user", async () => {
    const r = await submitCommunityQuestion("cats forever", "dogs forever");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "community", author_id: "u1", option_a: "cats forever" })
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("q1");
  });
});
