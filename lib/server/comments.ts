"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, commentSchema, likeSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";
import type { Comment } from "@/types";

export async function postComment(
  questionId: string,
  content: string,
  choice: "A" | "B",
  parentId?: string
): Promise<ActionResult<Comment>> {
  return run(async () => {
    const input = parseOrThrow(commentSchema, { questionId, content, choice, parentId });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { data, error } = await db
      .from("comments")
      .insert({
        question_id: input.questionId,
        content: input.content,
        choice: input.choice,
        user_id: user.id,
        parent_id: input.parentId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Comment;
  });
}

export async function likeComment(commentId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(likeSchema, { commentId });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { error } = await db.rpc("like_comment", { p_comment_id: input.commentId, p_user_id: user.id });
    if (error) throw error;
    return null;
  });
}
