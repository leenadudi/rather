import { describe, it, expect, vi, beforeEach } from "vitest";
const { requireAccount } = vi.hoisted(() => ({ requireAccount: vi.fn() }));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { reportInsert, updateStatus, reportCount } = vi.hoisted(() => ({ reportInsert: vi.fn(), updateStatus: vi.fn(), reportCount: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/ratelimit", () => ({ checkRateLimit }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (t: string) => t === "reports"
      ? { upsert: (r: unknown) => { reportInsert(r); return { error: null }; },
          select: () => ({ eq: () => ({ eq: () => ({ then: (res: (v: { count: number }) => void) => res({ count: reportCount() }) }) }) }) }
      : { update: (u: unknown) => { updateStatus(u); return { eq: () => ({ error: null }) }; } },
  }),
}));
import { reportContent } from "@/lib/server/moderation";
beforeEach(() => { [requireAccount, checkRateLimit, reportInsert, updateStatus, reportCount].forEach(m => m.mockReset()); requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false }); checkRateLimit.mockResolvedValue(undefined); reportCount.mockReturnValue(1); });

describe("reportContent", () => {
  it("rejects an invalid target id without writing", async () => {
    const r = await reportContent("question", "nope");
    expect(r.ok).toBe(false);
    expect(reportInsert).not.toHaveBeenCalled();
  });
  it("records a report and does not hide below threshold", async () => {
    reportCount.mockReturnValue(1);
    const r = await reportContent("question", "11111111-1111-1111-1111-111111111111", "spam");
    expect(reportInsert).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: "u1", target_type: "question" }));
    expect(updateStatus).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
  it("hides the question at/above the threshold", async () => {
    reportCount.mockReturnValue(3);
    await reportContent("question", "11111111-1111-1111-1111-111111111111");
    expect(updateStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "hidden" }));
  });
});
