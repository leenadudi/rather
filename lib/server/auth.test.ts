import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cookie-aware server client so these tests are hermetic.
const getUser = vi.fn();
const signInAnonymously = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({ auth: { getUser, signInAnonymously } }),
}));

import { getSessionUser, requireAccount, ensureAnonUser } from "@/lib/server/auth";
import { ActionError } from "@/lib/server/result";

beforeEach(() => {
  getUser.mockReset();
  signInAnonymously.mockReset();
});

describe("getSessionUser", () => {
  it("returns null when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getSessionUser()).toBeNull();
  });

  it("maps an anonymous user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "a1", is_anonymous: true } } });
    expect(await getSessionUser()).toEqual({ id: "a1", isAnonymous: true });
  });

  it("treats a missing is_anonymous flag as a real account", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await getSessionUser()).toEqual({ id: "u1", isAnonymous: false });
  });
});

describe("requireAccount", () => {
  it("throws account_required when anonymous", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "a1", is_anonymous: true } } });
    await expect(requireAccount()).rejects.toMatchObject({ code: "account_required" });
  });

  it("throws account_required when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAccount()).rejects.toBeInstanceOf(ActionError);
  });

  it("returns the user when it is a real account", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: false } } });
    expect(await requireAccount()).toEqual({ id: "u1", isAnonymous: false });
  });
});

describe("ensureAnonUser", () => {
  it("returns the existing user without creating one", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: false } } });
    expect(await ensureAnonUser()).toEqual({ id: "u1", isAnonymous: false });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates an anonymous user when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    signInAnonymously.mockResolvedValue({ data: { user: { id: "a9" } }, error: null });
    expect(await ensureAnonUser()).toEqual({ id: "a9", isAnonymous: true });
    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it("throws when anonymous sign-in fails", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    signInAnonymously.mockResolvedValue({ data: { user: null }, error: { message: "boom" } });
    await expect(ensureAnonUser()).rejects.toMatchObject({ code: "auth_failed" });
  });
});
