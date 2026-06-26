import { describe, it, expect, vi, beforeEach } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/server/supabase", () => ({ createServiceSupabase: () => ({ rpc }) }));
import { checkRateLimit } from "@/lib/server/ratelimit";
import { ActionError } from "@/lib/server/result";

beforeEach(() => rpc.mockReset());

describe("checkRateLimit", () => {
  it("passes when under the limit", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(checkRateLimit("u1", "comment", 5, 60)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", { p_user_id: "u1", p_action: "comment", p_limit: 5, p_window_seconds: 60 });
  });
  it("throws rate_limited when over the limit", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(checkRateLimit("u1", "comment", 5, 60)).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("fails open when the function is not installed (42883)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } });
    await expect(checkRateLimit("u1", "comment", 5, 60)).resolves.toBeUndefined();
  });
  it("propagates other rpc errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(checkRateLimit("u1", "comment", 5, 60)).rejects.toBeTruthy();
  });
});
