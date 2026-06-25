import { supabase } from "./supabase";
import type { Comment } from "@/types";

export type CommentSort = "top" | "new" | "hot";
export type CommentFilter = "all" | "A" | "B";

export async function getComments(
  questionId: string,
  sort: CommentSort = "top",
  filter: CommentFilter = "all"
): Promise<Comment[]> {
  let query = supabase
    .from("comments")
    .select("*")
    .eq("question_id", questionId)
    .is("parent_id", null);

  if (filter !== "all") query = query.eq("choice", filter);

  if (sort === "new") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "hot") {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    query = query
      .gte("created_at", oneHourAgo)
      .order("likes", { ascending: false });
  } else {
    query = query.order("likes", { ascending: false });
  }

  const { data } = await query.limit(50);
  return (data ?? []) as Comment[];
}

export async function getReplies(parentId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Comment[];
}

export async function getCommentCount(questionId: string): Promise<number> {
  const { count } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("question_id", questionId);
  return count ?? 0;
}
