import { describe, it, expect, vi, beforeEach } from "vitest";

const { gt } = vi.hoisted(() => ({ gt: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: (col: string, val: string) => {
              gt(col, val);
              return Promise.resolve({
                data: [
                  { user_a_id: "a1", user_b_id: null },
                  { user_a_id: null, user_b_id: "b1" },
                  { user_a_id: "a2", user_b_id: null },
                ],
              });
            },
          }),
        }),
      }),
    }),
  },
}));

import { getQueueCounts } from "@/lib/debates";

beforeEach(() => gt.mockReset());

describe("getQueueCounts", () => {
  it("filters waiting rows by a recent last_seen_at and counts per side", async () => {
    const res = await getQueueCounts("q1");
    expect(gt).toHaveBeenCalledWith("last_seen_at", expect.any(String));
    expect(res).toEqual({ a: 2, b: 1 });
  });
});
