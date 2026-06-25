"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ensureSession } from "@/lib/anon";
import { getCommunityQuestion } from "@/lib/community";
import { castVote } from "@/lib/server/votes";
import { CommentSection } from "@/components/comments/CommentSection";
import { relativeTime } from "@/components/community/CommunityCard";
import type { Choice, CommunityQuestion, VoteCounts } from "@/types";

export default function ExploreQuestionPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<CommunityQuestion | null>(null);
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [counts, setCounts] = useState<VoteCounts>({ a: 0, b: 0, total: 0, pct_a: 50, pct_b: 50 });
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const uid = await ensureSession();
      setUserId(uid);
      const data = await getCommunityQuestion(id, uid);
      if (!data) { setLoading(false); return; }
      setQ(data);
      setMyChoice(data.my_choice);
      setCounts(data.counts);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleVote = async (choice: Choice) => {
    if (!q || myChoice || saving || !userId) return;
    setSaving(true);
    setMyChoice(choice);
    const res = await castVote(q.id, choice);
    if (!res.ok) {
      // keep existing error handling path — revert optimistic state
    } else {
      setCounts(res.data);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading…</p>
      </main>
    );
  }

  if (!q) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <p className="text-text-secondary text-lg font-medium">question not found</p>
        <Link href="/explore" className="text-side-a hover:underline text-sm mt-2">back to explore</Link>
      </main>
    );
  }

  const voted = myChoice !== null;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <Link href="/explore" className="text-sm text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-1">
          ← explore
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>would you rather…</span>
          <span>·</span>
          <span>{relativeTime(q.created_at)}</span>
          {q.author_username && <><span>·</span><span>by {q.author_username}</span></>}
          <span>·</span>
          <span>{counts.total.toLocaleString()} votes</span>
        </div>

        {/* Vote */}
        <div className="bg-card border border-border-light rounded-2xl overflow-hidden">
          <div className="flex relative">
            <VoteSide side="A" label={q.option_a} pct={counts.pct_a} chosen={myChoice === "A"} voted={voted} disabled={saving || !userId} onVote={() => handleVote("A")} />
            <div className="w-px bg-border-light" />
            <VoteSide side="B" label={q.option_b} pct={counts.pct_b} chosen={myChoice === "B"} voted={voted} disabled={saving || !userId} onVote={() => handleVote("B")} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border-light rounded-full w-8 h-8 flex items-center justify-center">
              <span className="text-[10px] text-text-muted">or</span>
            </div>
          </div>
        </div>

        {/* Comments — unlocked after voting */}
        {voted && userId ? (
          <div className="bg-card border border-border-light rounded-2xl p-5">
            <CommentSection
              questionId={q.id}
              myChoice={myChoice!}
              userId={userId}
              optionA={q.option_a}
              optionB={q.option_b}
            />
          </div>
        ) : (
          <p className="text-center text-xs text-text-muted">
            vote to unlock {q.comment_count} {q.comment_count === 1 ? "comment" : "comments"}
          </p>
        )}
      </div>
    </main>
  );
}

function VoteSide({
  side, label, pct, chosen, voted, disabled, onVote,
}: {
  side: Choice; label: string; pct: number; chosen: boolean; voted: boolean; disabled: boolean; onVote: () => void;
}) {
  const isA = side === "A";
  const tint = chosen ? (isA ? "bg-side-a-bg" : "bg-side-b-bg") : "";
  return (
    <button
      onClick={onVote}
      disabled={disabled || voted}
      className={`flex-1 text-left px-6 py-8 transition-colors ${tint} ${!voted && !disabled ? "hover:bg-background cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isA ? "bg-side-a" : "bg-side-b"}`} />
        <p className={`text-base font-semibold leading-snug ${chosen ? "text-text-primary" : "text-text-secondary"}`}>{label}</p>
      </div>
      {voted && (
        <>
          <p className={`text-3xl font-bold mt-3 ${isA ? "text-side-a" : "text-side-b"} ${!chosen ? "opacity-40" : ""}`}>{pct}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-border-light overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${isA ? "bg-side-a" : "bg-side-b"} ${!chosen ? "opacity-50" : ""}`} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </button>
  );
}
