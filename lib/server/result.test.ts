import { describe, it, expect } from "vitest";
import { ok, fail, ActionError, resultFromError } from "@/lib/server/result";

describe("result helpers", () => {
  it("ok() wraps data", () => {
    expect(ok({ n: 1 })).toEqual({ ok: true, data: { n: 1 } });
  });

  it("fail() carries error + optional code", () => {
    expect(fail("nope", "bad")).toEqual({ ok: false, error: "nope", code: "bad" });
    expect(fail("nope")).toEqual({ ok: false, error: "nope", code: undefined });
  });

  it("resultFromError maps ActionError to fail with its code", () => {
    const r = resultFromError(new ActionError("account_required", "need an account"));
    expect(r).toEqual({ ok: false, error: "need an account", code: "account_required" });
  });

  it("resultFromError hides unknown errors behind a generic message", () => {
    const r = resultFromError(new Error("db exploded with secret details"));
    expect(r).toEqual({ ok: false, error: "something went wrong", code: "internal" });
  });
});
