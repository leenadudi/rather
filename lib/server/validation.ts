import { z } from "zod";
import { ActionError } from "@/lib/server/result";

const uuid = z.string().uuid();
const choice = z.enum(["A", "B"]);

export const voteSchema = z.object({ questionId: uuid, choice });
export const commentSchema = z.object({
  questionId: uuid,
  content: z.string().trim().min(1).max(2000),
  choice,
  parentId: uuid.optional(),
});
export const likeSchema = z.object({ commentId: uuid });
export const joinDebateSchema = z.object({ questionId: uuid, side: choice });
export const debateMessageSchema = z.object({ debateId: uuid, content: z.string().trim().min(1).max(1000) });
export const communitySubmitSchema = z.object({
  optionA: z.string().trim().min(2).max(120),
  optionB: z.string().trim().min(2).max(120),
});
export const friendRequestSchema = z.object({ toId: uuid });
export const respondRequestSchema = z.object({ requestId: uuid, accept: z.boolean() });
export const predictionSchema = z.object({ targetId: uuid, questionId: uuid, choice });

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ActionError("invalid_input", first?.message ?? "invalid input");
  }
  return result.data;
}
