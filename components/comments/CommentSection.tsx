"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccountGate } from "@/components/auth/useRequireAccount";
import type { Choice, Comment } from "@/types";
import { getComments, getReplies, type CommentSort, type CommentFilter } from "@/lib/comments";
import { postComment, likeComment } from "@/lib/server/comments";
import { SortTabs } from "./SortTabs";
import { FilterChips } from "./FilterChips";
import { CommentItem } from "./CommentItem";
import { CommentInput } from "./CommentInput";

interface Props {
  questionId: string;
  myChoice: Choice;
  userId: string | null;
  optionA?: string;
  optionB?: string;
}

export function CommentSection({ questionId, myChoice, userId, optionA, optionB }: Props) {
  const gate = useAccountGate();
  const [sort, setSort] = useState<CommentSort>("top");
  const [filter, setFilter] = useState<CommentFilter>("all");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getComments(questionId, sort, filter);
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
    setPostError(null);
    const res = gate(await postComment(questionId, content, myChoice));
    if (!res.ok && res.code === "rate_limited") {
      setPostError(res.error);
      return;
    }
    const created = res.ok ? res.data : null;
    if (created) {
      setComments((prev) => [{ ...created, likes: 0, replies: [] }, ...prev]);
    }
  };

  const handleLike = async (commentId: string) => {
    const res = gate(await likeComment(commentId));
    if (!res.ok) return;
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
    const res = gate(await postComment(questionId, content, myChoice, parentId));
    const created = res.ok ? res.data : null;
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
        <FilterChips value={filter} onChange={setFilter} optionA={optionA} optionB={optionB} />
      </div>

      <div className="mb-4">
        {userId ? (
          <>
            <CommentInput onPost={handlePost} />
            {postError && (
              <p className="mt-2 text-sm text-error">{postError}</p>
            )}
          </>
        ) : (
          <Link
            href="/signin"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-muted hover:border-text-secondary transition-colors"
          >
            <span>create an account to join the conversation</span>
            <span className="font-semibold text-text-primary shrink-0">sign up →</span>
          </Link>
        )}
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
