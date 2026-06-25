import { describe, it, expect } from "vitest";
import { parseOrThrow, voteSchema, commentSchema, communitySubmitSchema } from "@/lib/server/validation";
import { ActionError } from "@/lib/server/result";

describe("validation", () => {
  it("accepts a valid vote", () => {
    expect(parseOrThrow(voteSchema, { questionId: "11111111-1111-1111-1111-111111111111", choice: "A" }))
      .toEqual({ questionId: "11111111-1111-1111-1111-111111111111", choice: "A" });
  });
  it("rejects a bad choice with invalid_input", () => {
    expect(() => parseOrThrow(voteSchema, { questionId: "11111111-1111-1111-1111-111111111111", choice: "C" }))
      .toThrowError(expect.objectContaining({ code: "invalid_input" }));
  });
  it("rejects an empty comment", () => {
    expect(() => parseOrThrow(commentSchema, { questionId: "11111111-1111-1111-1111-111111111111", content: "", choice: "A" }))
      .toThrow(ActionError);
  });
  it("rejects an over-long comment", () => {
    const long = "x".repeat(2001);
    expect(() => parseOrThrow(commentSchema, { questionId: "11111111-1111-1111-1111-111111111111", content: long, choice: "A" }))
      .toThrow(ActionError);
  });
  it("trims and accepts community options", () => {
    const r = parseOrThrow(communitySubmitSchema, { optionA: "  cats  ", optionB: "dogs" });
    expect(r).toEqual({ optionA: "cats", optionB: "dogs" });
  });
});
