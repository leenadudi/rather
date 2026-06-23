"use client";

import { useCallback, useEffect, useState } from "react";
import type { Choice, Comment } from "@/types";
import { getComments, getReplies, postComment, likeComment, type CommentSort, type CommentFilter } from "@/lib/comments";
import { getDeviceId } from "@/lib/fingerprint";
import { SortTabs } from "./SortTabs";
import { FilterChips } from "./FilterChips";
import { CommentItem } from "./CommentItem";
import { CommentInput } from "./CommentInput";

interface Props {
  questionId: string;
  myChoice: Choice;
  userId?: string;
}

export function CommentSection({ questionId, myChoice, userId }: Props) {
  const [sort, setSort] = useState<CommentSort>("top");
  const [filter, setFilter] = useState<CommentFilter>("all");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getComments(questionId, sort, filter);
    // Attach replies
    const withReplies = await Promise.all(
      data.map(async (c) => {
        const replies = await getReplies(c.id);
        return { ...c, replies };
      })
    );
    setComments(withReplies);
    setLoading(false);
  }, [questionId, sort, filter]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async (content: string) => {
    const deviceId = getDeviceId();
    const created = await postComment(questionId, content, myChoice, deviceId, userId);
    if (created) {
      setComments((prev) => [{ ...created, likes: 0, replies: [] }, ...prev]);
    }
  };

  const handleLike = async (commentId: string) => {
    const deviceId = getDeviceId();
    await likeComment(commentId, deviceId, userId);
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) return { ...c, likes: c.likes + 1, liked_by_me: true };
        return {
          ...c,
          replies: c.replies?.map((r) =>
            r.id === commentId ? { ...r, likes: r.likes + 1, liked_by_me: true } : r
          ),
        };
      })
    );
  };

  const handleReply = async (parentId: string, content: string) => {
    const deviceId = getDeviceId();
    const created = await postComment(questionId, content, myChoice, deviceId, userId, parentId);
    if (created) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies ?? []), { ...created, replies: [] }] }
            : c
        )
      );
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text-primary">comments</h2>
        <div className="flex items-center gap-2">
          <SortTabs value={sort} onChange={setSort} />
        </div>
      </div>

      <div className="mb-4">
        <FilterChips value={filter} onChange={setFilter} />
      </div>

      <div className="mb-4">
        <CommentInput onPost={handlePost} />
      </div>

      {loading ? (
        <p className="text-sm text-text-muted py-4 text-center">loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">
          no comments yet — be the first
        </p>
      ) : (
        <div className="divide-y divide-border-light">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onLike={handleLike}
              onReply={handleReply}
            />
          ))}
        </div>
      )}
    </section>
  );
}
