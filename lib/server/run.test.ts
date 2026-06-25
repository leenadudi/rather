import { describe, it, expect } from "vitest";
import { run } from "@/lib/server/run";
import { ActionError } from "@/lib/server/result";

describe("run", () => {
  it("wraps a successful result in ok()", async () => {
    expect(await run(async () => 42)).toEqual({ ok: true, data: 42 });
  });
  it("maps a thrown ActionError to fail() with its code", async () => {
    const r = await run(async () => { throw new ActionError("bad", "nope"); });
    expect(r).toEqual({ ok: false, error: "nope", code: "bad" });
  });
  it("hides unknown errors", async () => {
    const r = await run(async () => { throw new Error("secret"); });
    expect(r).toEqual({ ok: false, error: "something went wrong", code: "internal" });
  });
});
