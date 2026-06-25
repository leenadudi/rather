"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Choice, CommunityQuestion, VoteCounts } from "@/types";
import { castVote, getVoteCounts } from "@/lib/votes";

interface Props {
  question: CommunityQuestion;
  userId: string | null;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function CommunityCard({ question, userId }: Props) {
  const router = useRouter();
  const [myChoice, setMyChoice] = useState<Choice | null>(question.my_choice);
  const [counts, setCounts] = useState<VoteCounts>(question.counts);
  const [saving, setSaving] = useState(false);

  const handleVote = async (choice: Choice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (myChoice || saving || !userId) return;
    setSaving(true);
    // optimistic
    setMyChoice(choice);
    setCounts((c) => {
      const a = c.a + (choice === "A" ? 1 : 0);
      const b = c.b + (choice === "B" ? 1 : 0);
      const total = a + b;
      return { a, b, total, pct_a: Math.round((a / total) * 100), pct_b: Math.round((b / total) * 100) };
    });
    const { error } = await castVote(question.id, choice, userId);
    if (!error) {
      const fresh = await getVoteCounts(question.id);
      setCounts(fresh);
    }
    setSaving(false);
  };

  const goToQuestion = () => router.push(`/explore/${question.id}`);

  const voted = myChoice !== null;

  return (
    <div
      onClick={goToQuestion}
      className="bg-card border border-border-light rounded-2xl overflow-hidden cursor-pointer hover:border-border transition-colors"
    >
      {/* Header */}
      <div className="px-5 py-2.5 border-b border-border-light flex items-center gap-2 text-[11px] text-text-muted">
        <span>would you rather…</span>
        <span>·</span>
        <span>{relativeTime(question.created_at)}</span>
        <span>·</span>
        <span>{counts.total.toLocaleString()} votes</span>
        <span>·</span>
        <span>💬 {question.comment_count}</span>
      </div>

      {/* Two sides */}
      <div className="flex relative">
        <Side
          side="A"
          label={question.option_a}
          pct={counts.pct_a}
          chosen={myChoice === "A"}
          voted={voted}
          disabled={saving || !userId}
          onVote={(e) => handleVote("A", e)}
        />
        <div className="w-px bg-border-light" />
        <Side
          side="B"
          label={question.option_b}
          pct={counts.pct_b}
          chosen={myChoice === "B"}
          voted={voted}
          disabled={saving || !userId}
          onVote={(e) => handleVote("B", e)}
        />
        {/* "or" pill */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border-light rounded-full w-7 h-7 flex items-center justify-center">
          <span className="text-[10px] text-text-muted">or</span>
        </div>
      </div>
    </div>
  );
}

function Side({
  side,
  label,
  pct,
  chosen,
  voted,
  disabled,
  onVote,
}: {
  side: Choice;
  label: string;
  pct: number;
  chosen: boolean;
  voted: boolean;
  disabled: boolean;
  onVote: (e: React.MouseEvent) => void;
}) {
  const isA = side === "A";
  const dotColor = isA ? "bg-side-a" : "bg-side-b";
  const pctColor = isA ? "text-side-a" : "text-side-b";
  const barColor = isA ? "bg-side-a" : "bg-side-b";
  const tint = chosen ? (isA ? "bg-side-a-bg" : "bg-side-b-bg") : "";

  return (
    <button
      onClick={onVote}
      disabled={disabled || voted}
      className={`flex-1 text-left px-5 py-5 transition-colors ${tint} ${
        !voted && !disabled ? "hover:bg-background cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
          <p className={`text-sm font-medium leading-snug ${chosen ? "text-text-primary" : "text-text-secondary"}`}>
            {label}
          </p>
        </div>
        {voted && (
          <span className={`text-sm font-bold shrink-0 ${pctColor} ${!chosen ? "opacity-40" : ""}`}>
            {pct}%
          </span>
        )}
      </div>
      {voted && (
        <div className="mt-3 h-1.5 rounded-full bg-border-light overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor} ${!chosen ? "opacity-50" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </button>
  );
}
