import { describe, it, expect, vi, beforeEach } from "vitest";
const { requireAccount } = vi.hoisted(() => ({ requireAccount: vi.fn() }));
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({ from: () => ({ upsert: (...a: unknown[]) => { upsert(...a); return { error: upsert.mock.results.at(-1)?.value ?? null }; } }) }),
}));
import { setUsername } from "@/lib/server/account";
beforeEach(() => { requireAccount.mockReset(); upsert.mockReset(); requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false }); });
describe("setUsername", () => {
  it("rejects an invalid username before writing", async () => {
    const r = await setUsername("ab");
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects when not a real account", async () => {
    requireAccount.mockRejectedValueOnce(new (await import("@/lib/server/result")).ActionError("account_required", "no"));
    const r = await setUsername("valid_name");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
  });
  it("upserts a valid username for the account", async () => {
    upsert.mockReturnValue(null);
    const r = await setUsername("Cool_Name");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", username: "cool_name" }), expect.anything());
    expect(r.ok).toBe(true);
  });
});
