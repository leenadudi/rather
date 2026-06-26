import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionError } from "@/lib/server/result";

const { requireAccount, friendInsert, selectSingle, respondUpdate, predUpsert, checkRateLimit } = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  friendInsert: vi.fn(),
  selectSingle: vi.fn(),
  respondUpdate: vi.fn(),
  predUpsert: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/ratelimit", () => ({ checkRateLimit }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        friendInsert(row);
        return { error: null };
      },
      select: () => ({
        eq: (_col: string, _val: string) => ({
          single: async () => selectSingle(),
        }),
      }),
      update: (data: unknown) => ({
        eq: (_col: string, _val: string) => {
          respondUpdate(data);
          return Promise.resolve({ error: null });
        },
      }),
      upsert: (row: unknown, opts: unknown) => {
        predUpsert(row, opts);
        return { error: null };
      },
    }),
  }),
}));

import { sendFriendRequest, respondToFriendRequest, makePrediction } from "@/lib/server/social";

beforeEach(() => {
  [requireAccount, friendInsert, selectSingle, respondUpdate, predUpsert, checkRateLimit].forEach((m) => m.mockReset());
  requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false });
  checkRateLimit.mockResolvedValue(undefined);
});

describe("sendFriendRequest", () => {
  it("rejects non-uuid toId", async () => {
    const r = await sendFriendRequest("not-a-uuid");
    expect(r.ok).toBe(false);
    expect(friendInsert).not.toHaveBeenCalled();
  });
  it("derives from_user_id server-side", async () => {
    const r = await sendFriendRequest("22222222-2222-2222-2222-222222222222");
    expect(friendInsert).toHaveBeenCalledWith(
      expect.objectContaining({ from_user_id: "u1", to_user_id: "22222222-2222-2222-2222-222222222222" })
    );
    expect(r.ok).toBe(true);
  });
  it("returns account_required and performs no write when requireAccount rejects", async () => {
    requireAccount.mockRejectedValue(new ActionError("account_required", "you need an account to do that"));
    const r = await sendFriendRequest("22222222-2222-2222-2222-222222222222");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
    expect(friendInsert).not.toHaveBeenCalled();
  });
});

describe("respondToFriendRequest", () => {
  it("rejects non-recipient with code not_authorized", async () => {
    selectSingle.mockResolvedValue({ data: { to_user_id: "other-user" }, error: null });
    const r = await respondToFriendRequest("33333333-3333-3333-3333-333333333333", true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_authorized");
    expect(respondUpdate).not.toHaveBeenCalled();
  });
  it("allows the recipient to accept", async () => {
    selectSingle.mockResolvedValue({ data: { to_user_id: "u1" }, error: null });
    const r = await respondToFriendRequest("33333333-3333-3333-3333-333333333333", true);
    expect(r.ok).toBe(true);
    expect(respondUpdate).toHaveBeenCalledWith({ status: "accepted" });
  });
});

describe("makePrediction", () => {
  it("upserts with predictor_id from server-derived user", async () => {
    const r = await makePrediction(
      "44444444-4444-4444-4444-444444444444",
      "55555555-5555-5555-5555-555555555555",
      "A"
    );
    expect(predUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ predictor_id: "u1", predicted_choice: "A" }),
      expect.objectContaining({ onConflict: "predictor_id,target_id,question_id" })
    );
    expect(r.ok).toBe(true);
  });
});
