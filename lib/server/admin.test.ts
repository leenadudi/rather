import { describe, it, expect, vi, beforeEach } from "vitest";

const { insertFn, selectFn, singleFn, deleteFn, eqDeleteFn, updateFn, eqUpdateFn } = vi.hoisted(() => ({
  insertFn: vi.fn(),
  selectFn: vi.fn(),
  singleFn: vi.fn(),
  deleteFn: vi.fn(),
  eqDeleteFn: vi.fn(),
  updateFn: vi.fn(),
  eqUpdateFn: vi.fn(),
}));

vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insertFn(row);
        return {
          select: () => ({
            single: () => singleFn(),
          }),
        };
      },
      delete: () => {
        deleteFn();
        return {
          eq: (col: string, val: string) => {
            eqDeleteFn(col, val);
            return { error: null };
          },
        };
      },
      update: (data: unknown) => {
        updateFn(data);
        return {
          eq: (col: string, val: string) => {
            eqUpdateFn(col, val);
            return { error: null };
          },
        };
      },
    }),
  }),
}));

import { adminCreateQuestion, adminDeleteQuestion, adminSetQuestionStatus } from "@/lib/server/admin";

beforeEach(() => {
  [insertFn, selectFn, singleFn, deleteFn, eqDeleteFn, updateFn, eqUpdateFn].forEach((m) => m.mockReset());
  singleFn.mockResolvedValue({ data: { id: "q-new-123" }, error: null });
});

describe("adminCreateQuestion", () => {
  it("rejects when optionA is empty", async () => {
    const r = await adminCreateQuestion({ optionA: "", optionB: "b", dimension: null, debateEnabled: true, publishedAt: "2026-01-01T00:00:00Z" });
    expect(r.ok).toBe(false);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("rejects when optionB is empty", async () => {
    const r = await adminCreateQuestion({ optionA: "a", optionB: "  ", dimension: null, debateEnabled: false, publishedAt: "2026-01-01T00:00:00Z" });
    expect(r.ok).toBe(false);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("inserts with option_a, option_b, type=daily and returns the id", async () => {
    const r = await adminCreateQuestion({
      optionA: "  know every secret  ",
      optionB: "have everyone know",
      dimension: "honesty_vs_tact",
      debateEnabled: true,
      publishedAt: "2026-06-25T00:00:00Z",
    });
    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      option_a: "know every secret",
      option_b: "have everyone know",
      type: "daily",
      dimension: "honesty_vs_tact",
      debate_enabled: true,
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("q-new-123");
  });
});

describe("adminDeleteQuestion", () => {
  it("deletes by id and returns null", async () => {
    const r = await adminDeleteQuestion("some-uuid");
    expect(deleteFn).toHaveBeenCalled();
    expect(eqDeleteFn).toHaveBeenCalledWith("id", "some-uuid");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });
});

describe("adminSetQuestionStatus", () => {
  it("rejects an invalid status", async () => {
    // @ts-expect-error testing bad input
    const r = await adminSetQuestionStatus("some-uuid", "published");
    expect(r.ok).toBe(false);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("updates status to approved", async () => {
    const r = await adminSetQuestionStatus("some-uuid", "approved");
    expect(updateFn).toHaveBeenCalledWith({ status: "approved" });
    expect(eqUpdateFn).toHaveBeenCalledWith("id", "some-uuid");
    expect(r.ok).toBe(true);
  });

  it("updates status to hidden", async () => {
    const r = await adminSetQuestionStatus("some-uuid", "hidden");
    expect(updateFn).toHaveBeenCalledWith({ status: "hidden" });
    expect(eqUpdateFn).toHaveBeenCalledWith("id", "some-uuid");
    expect(r.ok).toBe(true);
  });
});
