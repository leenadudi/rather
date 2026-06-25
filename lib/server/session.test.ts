import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureAnonUser } = vi.hoisted(() => ({ ensureAnonUser: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));

import { startSession } from "@/lib/server/session";

beforeEach(() => ensureAnonUser.mockReset());

describe("startSession", () => {
  it("returns the server-derived anon user id", async () => {
    ensureAnonUser.mockResolvedValue({ id: "srv-1", isAnonymous: true });
    const r = await startSession();
    expect(r).toEqual({ ok: true, data: { userId: "srv-1" } });
  });
  it("returns a fail result when auth fails", async () => {
    const { ActionError } = await import("@/lib/server/result");
    ensureAnonUser.mockRejectedValueOnce(new ActionError("auth_failed", "no"));
    const r = await startSession();
    expect(r.ok).toBe(false);
  });
});
