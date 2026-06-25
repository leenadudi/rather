import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionError } from "@/lib/server/result";

const { requireAccount, insert } = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
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
  requireAccount.mockReset();
  insert.mockReset();
  requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false });
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
  it("returns account_required and performs no write when requireAccount rejects", async () => {
    requireAccount.mockRejectedValue(new ActionError("account_required", "you need an account to do that"));
    const r = await submitCommunityQuestion("cats forever", "dogs forever");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
    expect(insert).not.toHaveBeenCalled();
  });
});
