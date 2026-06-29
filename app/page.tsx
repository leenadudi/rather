"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getTodayQuestion, getRecentQuestions } from "@/lib/questions";
import { getMyVote, getVoteCounts } from "@/lib/votes";
import { castVote } from "@/lib/server/votes";
import { readLocalVote, writeLocalVote } from "@/lib/localVotes";
import { getQueueCounts } from "@/lib/debates";
import { getCommentCount } from "@/lib/comments";
import { DebateCTA } from "@/components/vote/DebateCTA";
import { CommentSection } from "@/components/comments/CommentSection";
import { GroupSidebar } from "@/components/sidebar/GroupSidebar";
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
      setLabel(`next in ${h}h ${m}m`);
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

  // Sidebar state
  const [streak, setStreak] = useState(0);
  const [recentQ, setRecentQ] = useState<Question[]>([]);
  const [recentVotes, setRecentVotes] = useState<Record<string, Choice>>({});
  const [userId, setUserId] = useState<string | null>(null);

  const countdown = useCountdown(getNextMidnightUTC());

  useEffect(() => {
    async function init() {
      const q = await getTodayQuestion();
      if (!q) { setLoading(false); return; }
      setQuestion(q);

      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;

      const [voteCounts, queue, cc, recent] = await Promise.all([
        getVoteCounts(q.id),
        getQueueCounts(q.id),
        getCommentCount(q.id),
        getRecentQuestions(6),
      ]);

      // Signed-in users get their vote from the server; visitors from this browser.
      const existing = uid ? await getMyVote(q.id, uid) : readLocalVote(q.id);

      setMyChoice(existing);
      setCounts(voteCounts);
      setQueueCounts(queue);
      setCommentCount(cc);

      setUserId(uid);

      // Recent questions (skip today)
      const pastQ = recent.filter((r) => r.id !== q.id).slice(0, 4);
      setRecentQ(pastQ);

      // Streak + per-question vote markers are account-only — visitors have no
      // server-side vote history to read.
      if (uid) {
        if (pastQ.length > 0) {
          const qIds = pastQ.map((r) => r.id);
          const { data: rv } = await supabase
            .from("votes")
            .select("question_id, choice")
            .eq("user_id", uid)
            .in("question_id", qIds);
          const vm: Record<string, Choice> = {};
          for (const v of rv ?? []) vm[v.question_id] = v.choice as Choice;
          setRecentVotes(vm);
        }

        const { data: svotes } = await supabase
          .from("votes")
          .select("created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(60);
        if (svotes?.length) {
          const days = new Set(svotes.map((v) => new Date(v.created_at).toDateString()));
          const today = new Date();
          const start = days.has(today.toDateString()) ? today : new Date(today.getTime() - 86400000);
          let s = 0;
          const cursor = new Date(start);
          while (days.has(cursor.toDateString())) {
            s++;
            cursor.setDate(cursor.getDate() - 1);
          }
          setStreak(s);
        }
      }

      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!question) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`votes:${question.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `question_id=eq.${question.id}` }, () => {
        if (timer) return;
        timer = setTimeout(async () => {
          const fresh = await getVoteCounts(question.id);
          setCounts(fresh);
          timer = null;
        }, 1000);
      })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [question]);

  const handleVote = useCallback(async (choice: Choice) => {
    if (!question || myChoice) return;
    setMyChoice(choice);
    setSaving(choice);
    setSaveError(false);
    setPendingChoice(choice);
    const res = await castVote(question.id, choice);
    if (!res.ok) {
      setSaveError(true);
      setSaving(null);
    } else {
      if (!userId) writeLocalVote(question.id, choice, res.data.voteId);
      setSaving(null);
      setPendingChoice(null);
      setCounts(res.data);
    }
  }, [question, myChoice, userId]);

  const handleRetry = useCallback(async () => {
    if (!question || !pendingChoice) return;
    setSaveError(false);
    setSaving(pendingChoice);
    const res = await castVote(question.id, pendingChoice);
    if (!res.ok) {
      setSaveError(true);
      setSaving(null);
    } else {
      if (!userId) writeLocalVote(question.id, pendingChoice, res.data.voteId);
      setSaving(null);
      setPendingChoice(null);
      setCounts(res.data);
    }
  }, [question, pendingChoice, userId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading…</p>
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

  const pub = new Date(question.published_at);
  const dateStr = pub.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
  const shortDate = pub.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();
  const oppositeCount = myChoice ? (myChoice === "A" ? queueCounts.b : queueCounts.a) : queueCounts.a + queueCounts.b;

  // ── Full-screen pre-vote layout ──────────────────────────────
  if (!myChoice) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col sm:flex-row overflow-hidden">
        {/* Logo */}
        <div className="absolute top-5 left-6 z-30">
          <span className="text-sm font-bold text-white/40">rather</span>
        </div>

        {/* ── Option A — dark left panel ── */}
        <button
          onClick={() => !saving && handleVote("A")}
          disabled={!!saving}
          className="flex-1 relative bg-dark overflow-hidden text-left cursor-pointer transition-colors duration-200 hover:bg-[#161616]"
        >
          <div className="h-full flex flex-col justify-center px-10 sm:px-16 py-20">
            <p className="text-2xl sm:text-3xl font-bold text-white leading-snug max-w-xs">
              {saving === "A" ? <span className="opacity-60">saving…</span> : question.option_a}
            </p>
          </div>
        </button>

        {/* ── Option B — light right panel ── */}
        <button
          onClick={() => !saving && handleVote("B")}
          disabled={!!saving}
          className="flex-1 relative bg-background overflow-hidden text-right cursor-pointer transition-colors duration-200 hover:bg-[#F0EEE9]"
        >
          <div className="h-full flex flex-col justify-center items-end px-10 sm:px-16 py-20">
            <p className="text-2xl sm:text-3xl font-bold text-text-primary leading-snug max-w-xs">
              {saving === "B" ? <span className="opacity-60">saving…</span> : question.option_b}
            </p>
          </div>
        </button>

        {/* Error banner */}
        {saveError && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-error-bg border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
            <p className="text-sm text-error">vote didn&apos;t save</p>
            <button onClick={handleRetry} className="text-sm font-semibold text-error underline">
              retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="lg:grid lg:grid-cols-[220px_1fr_288px] lg:gap-6 space-y-6 lg:space-y-0">

          {/* ── Left sidebar ─────────────────────────────────── */}
          <aside className="hidden lg:block space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">
                today&apos;s question
              </p>
              <p className="text-base font-bold text-text-primary">{dateStr}</p>
            </div>

            {/* Votes today */}
            <div className="bg-card border border-border-light rounded-2xl p-4">
              <p className="text-2xl font-bold text-text-primary">{counts.total.toLocaleString()}</p>
              <p className="text-xs text-text-muted mt-0.5">votes today</p>
            </div>

            {/* Streak */}
            {streak > 0 && (
              <div className="bg-side-b-bg border border-side-b/20 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl">🔥</span>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{streak}</p>
                  <p className="text-xs text-text-muted">day streak</p>
                </div>
              </div>
            )}

            {/* Recent questions */}
            {recentQ.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                  recent questions
                </p>
                <div className="space-y-3">
                  {recentQ.map((q) => (
                    <div key={q.id} className="flex items-start justify-between gap-2">
                      <p className="text-xs text-text-secondary leading-snug flex-1 line-clamp-2">
                        {q.option_a.toLowerCase()}…
                      </p>
                      {recentVotes[q.id] && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 max-w-[64px] truncate ${
                            recentVotes[q.id] === "A"
                              ? "bg-side-a-bg text-side-a"
                              : "bg-side-b-bg text-side-b"
                          }`}
                          title={recentVotes[q.id] === "A" ? q.option_a : q.option_b}
                        >
                          {recentVotes[q.id] === "A"
                            ? (q.option_a.length <= 10 ? q.option_a : q.option_a.slice(0, 10).trimEnd() + "…")
                            : (q.option_b.length <= 10 ? q.option_b : q.option_b.slice(0, 10).trimEnd() + "…")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Center ───────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Error banner */}
            {saveError && (
              <div className="px-4 py-3 bg-error-bg border border-red-200 rounded-xl flex items-center justify-between">
                <p className="text-sm text-error">vote didn&apos;t save</p>
                <button onClick={handleRetry} className="text-sm font-semibold text-error underline">
                  retry
                </button>
              </div>
            )}

            {/* Vote card — post-vote results */}
            <div className="bg-card rounded-2xl border border-border-light overflow-hidden">
              <div className="px-5 py-3 border-b border-border-light flex items-center justify-between">
                <span className="text-xs text-text-muted">{shortDate} results</span>
                <span className="text-xs text-text-muted">{counts.total.toLocaleString()} votes</span>
              </div>

              <div className="px-6 py-5 space-y-5">
                {([
                  { label: question.option_a, pct: counts.pct_a, n: counts.a, side: "A" },
                  { label: question.option_b, pct: counts.pct_b, n: counts.b, side: "B" },
                ] as { label: string; pct: number; n: number; side: "A" | "B" }[]).map((opt) => {
                  const chosen = myChoice === opt.side;
                  const isA = opt.side === "A";
                  return (
                    <div key={opt.side}>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {chosen && (
                            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isA ? "bg-side-a" : "bg-side-b"}`}>
                              <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.8 6.79-6.8a1 1 0 011.42 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                          <p className={`text-base font-medium leading-snug ${chosen ? "text-text-primary" : "text-text-secondary"}`}>
                            {opt.label}
                          </p>
                        </div>
                        <span className={`text-3xl font-bold shrink-0 ${isA ? "text-side-a" : "text-side-b"}`}>
                          {opt.pct}%
                        </span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${isA ? "bg-side-a-bg" : "bg-side-b-bg"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isA ? "bg-side-a" : "bg-side-b"} ${!chosen ? "opacity-50" : ""}`}
                          style={{ width: `${opt.pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-text-muted mt-1">{opt.n.toLocaleString()} votes</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: stat chips */}
            <div className="flex gap-3 items-center lg:hidden text-xs text-text-muted">
              <span>{counts.total.toLocaleString()} votes</span>
              <span>·</span>
              <span>{queueCounts.a + queueCounts.b} debating</span>
              {myChoice && <><span>·</span><span>{countdown}</span></>}
            </div>

            {/* Debate CTA — mobile only; on desktop it lives in the right sidebar */}
            {myChoice && question.debate_enabled !== false && (
              <div className="lg:hidden">
                <DebateCTA
                  questionId={question.id}
                  myChoice={myChoice}
                  oppositeCount={oppositeCount}
                  optionA={question.option_a}
                  optionB={question.option_b}
                  hasAccount={!!userId}
                />
              </div>
            )}

            {/* Comments — readable by everyone after voting; posting needs an account */}
            {myChoice && (
              <CommentSection
                questionId={question.id}
                myChoice={myChoice}
                userId={userId}
                optionA={question.option_a}
                optionB={question.option_b}
              />
            )}

            {!myChoice && commentCount > 0 && (
              <p className="text-center text-xs text-text-muted">
                vote to unlock {commentCount} {commentCount === 1 ? "comment" : "comments"}
              </p>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────── */}
          <aside className="hidden lg:block space-y-4">
            {myChoice && question.debate_enabled !== false && (
              <DebateCTA
                questionId={question.id}
                myChoice={myChoice}
                oppositeCount={oppositeCount}
                optionA={question.option_a}
                optionB={question.option_b}
                hasAccount={!!userId}
              />
            )}
            <GroupSidebar
              questionId={question.id}
              myChoice={myChoice}
              optionA={question.option_a}
              optionB={question.option_b}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
