import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cookie-aware server client so these tests are hermetic.
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({ auth: { getUser } }),
}));

import { getSessionUser, requireAccount } from "@/lib/server/auth";
import { ActionError } from "@/lib/server/result";

beforeEach(() => {
  getUser.mockReset();
});

describe("getSessionUser", () => {
  it("returns null when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getSessionUser()).toBeNull();
  });

  it("maps a signed-in user to its id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await getSessionUser()).toEqual({ id: "u1" });
  });
});

describe("requireAccount", () => {
  it("throws account_required when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAccount()).rejects.toBeInstanceOf(ActionError);
    await expect(requireAccount()).rejects.toMatchObject({ code: "account_required" });
  });

  it("returns the user when signed in", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await requireAccount()).toEqual({ id: "u1" });
  });
});
