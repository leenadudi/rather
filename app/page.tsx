"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getTodayQuestion } from "@/lib/questions";
import { castVote, getMyVote, getVoteCounts } from "@/lib/votes";
import { getDeviceId } from "@/lib/fingerprint";
import { getQueueCounts } from "@/lib/debates";
import { getCommentCount } from "@/lib/comments";
import { VoteButtons } from "@/components/vote/VoteButtons";
import { ResultBars } from "@/components/vote/ResultBars";
import { DebateCTA } from "@/components/vote/DebateCTA";
import { CommentSection } from "@/components/comments/CommentSection";
import type { Choice, Question, VoteCounts } from "@/types";

function getNextMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function useCountdown(target: Date) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setLabel("new question dropping…"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(`next question in ${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [target]);
  return label;
}

export default function HomePage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [counts, setCounts] = useState<VoteCounts>({ a: 0, b: 0, total: 0, pct_a: 50, pct_b: 50 });
  const [saving, setSaving] = useState<Choice | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<Choice | null>(null);
  const [queueCounts, setQueueCounts] = useState({ a: 0, b: 0 });
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const countdown = useCountdown(getNextMidnightUTC());

  useEffect(() => {
    async function init() {
      const q = await getTodayQuestion();
      if (!q) { setLoading(false); return; }
      setQuestion(q);

      const deviceId = getDeviceId();
      const [existing, voteCounts, queue, cc] = await Promise.all([
        getMyVote(q.id, deviceId),
        getVoteCounts(q.id),
        getQueueCounts(q.id),
        getCommentCount(q.id),
      ]);

      setMyChoice(existing);
      setCounts(voteCounts);
      setQueueCounts(queue);
      setCommentCount(cc);
      setLoading(false);
    }
    init();
  }, []);

  // Realtime vote count — debounced to max 1 update/sec
  useEffect(() => {
    if (!question) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`votes:${question.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `question_id=eq.${question.id}` },
        () => {
          if (timer) return;
          timer = setTimeout(async () => {
            const fresh = await getVoteCounts(question.id);
            setCounts(fresh);
            timer = null;
          }, 1000);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [question]);

  const handleVote = useCallback(async (choice: Choice) => {
    if (!question || myChoice) return;
    setMyChoice(choice);
    setSaving(choice);
    setSaveError(false);
    setPendingChoice(choice);

    const deviceId = getDeviceId();
    const { error } = await castVote(question.id, choice, deviceId);
    if (error) {
      setSaveError(true);
      setSaving(null);
    } else {
      setSaving(null);
      setPendingChoice(null);
      const fresh = await getVoteCounts(question.id);
      setCounts(fresh);
    }
  }, [question, myChoice]);

  const handleRetry = useCallback(async () => {
    if (!question || !pendingChoice) return;
    setSaveError(false);
    setSaving(pendingChoice);
    const deviceId = getDeviceId();
    const { error } = await castVote(question.id, pendingChoice, deviceId);
    if (error) {
      setSaveError(true);
      setSaving(null);
    } else {
      setSaving(null);
      setPendingChoice(null);
      const fresh = await getVoteCounts(question.id);
      setCounts(fresh);
    }
  }, [question, pendingChoice]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading today&apos;s question…</p>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text-secondary text-lg font-medium">no question today</p>
          <p className="text-text-muted text-sm mt-2">check back tomorrow</p>
        </div>
      </main>
    );
  }

  const dateStr = new Date(question.published_at)
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toLowerCase();

  const oppositeCount = myChoice ? (myChoice === "A" ? queueCounts.b : queueCounts.a) : 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">
            {dateStr}
          </p>
          <h1 className="text-3xl font-bold text-text-primary">would you rather</h1>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-text-muted">
            <span>{counts.total.toLocaleString()} votes</span>
            <span>·</span>
            <span>{commentCount} comments</span>
            {myChoice && (
              <>
                <span>·</span>
                <span>{countdown}</span>
              </>
            )}
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="mb-4 px-4 py-3 bg-error-bg border border-red-200 rounded-xl flex items-center justify-between">
            <p className="text-sm text-error">vote didn&apos;t save — tap to retry</p>
            <button onClick={handleRetry} className="text-sm font-semibold text-error underline">
              retry
            </button>
          </div>
        )}

        {/* Vote card */}
        <div className="bg-card rounded-3xl border border-border-light p-6 shadow-sm mb-4">
          {!myChoice ? (
            <>
              <VoteButtons
                optionA={question.option_a}
                optionB={question.option_b}
                onVote={handleVote}
                disabled={!!saving}
                saving={saving}
              />
              {counts.total === 0 && (
                <p className="text-center text-xs text-text-muted mt-4">
                  be the first to vote today
                </p>
              )}
              {counts.total > 0 && (
                <p className="text-center text-xs text-text-muted mt-4">
                  tap to vote and reveal results
                </p>
              )}
            </>
          ) : (
            <ResultBars
              optionA={question.option_a}
              optionB={question.option_b}
              counts={counts}
              myChoice={myChoice}
            />
          )}
        </div>

        {/* Debate CTA */}
        {myChoice && question.debate_enabled !== false && (
          <div className="mb-6">
            <DebateCTA
              questionId={question.id}
              myChoice={myChoice}
              oppositeCount={oppositeCount}
            />
          </div>
        )}

        {/* Comments */}
        {myChoice && (
          <CommentSection questionId={question.id} myChoice={myChoice} />
        )}

        {!myChoice && commentCount > 0 && (
          <p className="text-center text-xs text-text-muted mt-6">
            vote to unlock {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </p>
        )}
      </div>
    </main>
  );
}
