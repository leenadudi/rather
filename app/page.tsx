"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getTodayQuestion, getRecentQuestions } from "@/lib/questions";
import { castVote, getMyVote, getVoteCounts } from "@/lib/votes";
import { getDeviceId } from "@/lib/fingerprint";
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

      const deviceId = getDeviceId();
      const [existing, voteCounts, queue, cc, recent, authData] = await Promise.all([
        getMyVote(q.id, deviceId),
        getVoteCounts(q.id),
        getQueueCounts(q.id),
        getCommentCount(q.id),
        getRecentQuestions(6),
        supabase.auth.getUser(),
      ]);

      setMyChoice(existing);
      setCounts(voteCounts);
      setQueueCounts(queue);
      setCommentCount(cc);

      const uid = authData.data.user?.id ?? null;
      setUserId(uid);

      // Recent questions (skip today)
      const pastQ = recent.filter((r) => r.id !== q.id).slice(0, 4);
      setRecentQ(pastQ);

      // Get votes for recent questions
      if (pastQ.length > 0) {
        const qIds = pastQ.map((r) => r.id);
        const votesQuery = uid
          ? supabase.from("votes").select("question_id, choice").eq("user_id", uid).in("question_id", qIds)
          : supabase.from("votes").select("question_id, choice").eq("device_id", deviceId).in("question_id", qIds);
        const { data: rv } = await votesQuery;
        const vm: Record<string, Choice> = {};
        for (const v of rv ?? []) vm[v.question_id] = v.choice as Choice;
        setRecentVotes(vm);
      }

      // Streak calculation
      const streakQuery = uid
        ? supabase.from("votes").select("created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(60)
        : supabase.from("votes").select("created_at").eq("device_id", deviceId).order("created_at", { ascending: false }).limit(60);
      const { data: svotes } = await streakQuery;
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
    if (error) { setSaveError(true); setSaving(null); }
    else {
      setSaving(null);
      setPendingChoice(null);
      const fresh = await getVoteCounts(question.id);
      setCounts(fresh);
    }
  }, [question, pendingChoice]);

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

            {/* Debating now */}
            <div className="bg-card border border-border-light rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-online inline-block" />
                <p className="text-2xl font-bold text-text-primary">{queueCounts.a + queueCounts.b}</p>
              </div>
              <p className="text-xs text-text-muted">waiting to debate</p>
            </div>

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
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            recentVotes[q.id] === "A"
                              ? "bg-side-a-bg text-side-a"
                              : "bg-side-b-bg text-side-b"
                          }`}
                        >
                          voted {recentVotes[q.id]!.toLowerCase()}
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
                        <div className="flex items-center gap-2 min-w-0">
                          {chosen && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isA ? "bg-side-a text-white" : "bg-side-b text-white"}`}>
                              ✓
                            </span>
                          )}
                          <p className={`text-sm font-medium leading-snug ${chosen ? "text-text-primary" : "text-text-secondary"}`}>
                            {opt.label}
                          </p>
                        </div>
                        <span className={`text-2xl font-bold shrink-0 ${isA ? "text-side-a" : "text-side-b"} ${!chosen ? "opacity-40" : ""}`}>
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

            {/* Debate CTA */}
            {myChoice && question.debate_enabled !== false && (
              <DebateCTA
                questionId={question.id}
                myChoice={myChoice}
                oppositeCount={oppositeCount}
              />
            )}

            {/* Sign-up nudge for anon users after voting */}
            {myChoice && !userId && (
              <div className="bg-card border border-border-light rounded-2xl p-5">
                <p className="text-sm font-semibold text-text-primary mb-1">create an account to unlock</p>
                <div className="grid grid-cols-2 gap-2 my-3">
                  {[
                    ["vote history", "every question, saved forever"],
                    ["character cards", "monthly summaries of your choices"],
                    ["friend groups", "see how your friends vote"],
                    ["shareable cards", "share results with friends"],
                  ].map(([title, desc]) => (
                    <div key={title} className="bg-background rounded-xl p-3">
                      <p className="text-xs font-semibold text-text-primary">{title}</p>
                      <p className="text-[11px] text-text-muted leading-snug mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mb-3">
                  🔒 no email required. no tracking. just a username + password.
                </p>
                <Link
                  href="/signup"
                  className="block w-full py-2.5 bg-dark text-white text-sm font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors"
                >
                  create free account
                </Link>
                <p className="text-xs text-text-muted text-center mt-2">
                  already have one?{" "}
                  <Link href="/signin" className="text-side-a hover:underline">
                    sign in
                  </Link>
                </p>
              </div>
            )}

            {/* Comments */}
            {myChoice && (
              <CommentSection questionId={question.id} myChoice={myChoice} />
            )}

            {!myChoice && commentCount > 0 && (
              <p className="text-center text-xs text-text-muted">
                vote to unlock {commentCount} {commentCount === 1 ? "comment" : "comments"}
              </p>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────── */}
          <aside className="hidden lg:block space-y-4">
            <GroupSidebar questionId={question.id} myChoice={myChoice} />
          </aside>
        </div>
      </div>
    </main>
  );
}
