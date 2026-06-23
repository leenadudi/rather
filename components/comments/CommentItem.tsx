"use client";

import { useState } from "react";
import type { Comment } from "@/types";
import { CommentInput } from "./CommentInput";

interface Props {
  comment: Comment;
  onLike: (id: string) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  depth?: number;
}

export function CommentItem({ comment, onLike, onReply, depth = 0 }: Props) {
  const [showReply, setShowReply] = useState(false);

  const choiceColor = comment.choice === "A" ? "text-side-a bg-side-a-bg" : "text-side-b bg-side-b-bg";
  const timeAgo = formatTimeAgo(new Date(comment.created_at));

  return (
    <div className={`${depth > 0 ? "ml-8 border-l-2 border-border-light pl-4" : ""}`}>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full bg-border-light flex items-center justify-center text-xs text-text-muted font-medium">
            A
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${choiceColor}`}>
            voted {comment.choice === "A" ? "a" : "b"}
          </span>
          <span className="text-xs text-text-muted">{timeAgo}</span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-1 text-xs transition-colors ${
              comment.liked_by_me ? "text-side-a font-semibold" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <span>♥</span>
            <span>{comment.likes}</span>
          </button>
          {depth === 0 && (
            <button
              onClick={() => setShowReply((v) => !v)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              reply
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onLike={onLike}
          onReply={onReply}
          depth={1}
        />
      ))}

      {showReply && depth === 0 && (
        <div className="ml-8 mb-3">
          <CommentInput
            placeholder="write a reply…"
            autoFocus
            onPost={async (content) => {
              await onReply(comment.id, content);
              setShowReply(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
