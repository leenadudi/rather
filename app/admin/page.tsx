"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Question, QuestionDimension } from "@/types";

const DIMENSIONS: { value: QuestionDimension | "none"; label: string; description: string }[] = [
  { value: "none", label: "none — just for fun", description: "won't affect character card" },
  { value: "honesty_vs_tact", label: "honesty vs tact", description: "truth-telling, white lies, social comfort" },
  { value: "autonomy_vs_belonging", label: "autonomy vs belonging", description: "independence, community, fitting in" },
  { value: "experience_vs_security", label: "experience vs security", description: "risk, adventure, stability, comfort" },
  { value: "clarity_vs_kindness", label: "clarity vs kindness", description: "directness, softening, feelings vs facts" },
  { value: "individual_vs_social", label: "individual vs social", description: "self vs group, personal vs collective" },
  { value: "present_vs_future", label: "present vs future", description: "instant gratification vs long-term thinking" },
];

function todayMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function tomorrowMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [dimension, setDimension] = useState<QuestionDimension | "none">("none");
  const [scheduleFor, setScheduleFor] = useState<"today" | "tomorrow" | "custom">("today");
  const [customDate, setCustomDate] = useState("");
  const [debateEnabled, setDebateEnabled] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [liveCounts, setLiveCounts] = useState<{ a: number; b: number; total: number } | null>(null);
  const [dbError, setDbError] = useState(false);

  const handleAuth = () => {
    if (pw === "admin123" || pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setPwError(true);
    }
  };

  useEffect(() => {
    if (authed) loadQuestions();
  }, [authed]);

  const loadQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(20);

    if (error?.message?.includes("does not exist")) {
      setDbError(true);
      setLoading(false);
      return;
    }

    setQuestions((data ?? []) as Question[]);

    if (data?.[0]) {
      const { data: votes } = await supabase
        .from("votes")
        .select("choice")
        .eq("question_id", data[0].id);
      const a = votes?.filter((v) => v.choice === "A").length ?? 0;
      const b = votes?.filter((v) => v.choice === "B").length ?? 0;
      setLiveCounts({ a, b, total: a + b });
    }
    setLoading(false);
  };

  const handlePost = async () => {
    if (!optionA.trim() || !optionB.trim()) {
      setPostMsg({ text: "fill in both options", ok: false });
      return;
    }
    if (scheduleFor === "custom" && !customDate) {
      setPostMsg({ text: "pick a date", ok: false });
      return;
    }

    let publishAt: string;
    if (scheduleFor === "today") publishAt = todayMidnightUTC();
    else if (scheduleFor === "tomorrow") publishAt = tomorrowMidnightUTC();
    else publishAt = new Date(customDate).toISOString();

    setPosting(true);
    setPostMsg(null);

    const { error } = await supabase.from("questions").insert({
      option_a: optionA.trim(),
      option_b: optionB.trim(),
      dimension: dimension === "none" ? null : dimension,
      debate_enabled: debateEnabled,
      published_at: publishAt,
    });

    if (error) {
      setPostMsg({ text: error.message, ok: false });
    } else {
      setPostMsg({ text: "question posted ✓", ok: true });
      setOptionA("");
      setOptionB("");
      loadQuestions();
    }
    setPosting(false);
  };

  const handleKill = async (id: string) => {
    if (!confirm("delete this question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    loadQuestions();
  };

  // ── Login screen ──────────────────────────────────────────
  if (!authed) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-xs">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-6">
            admin
          </p>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="password"
            autoFocus
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary mb-3 transition-colors"
          />
          {pwError && <p className="text-xs text-error mb-3">wrong password</p>}
          <button
            onClick={handleAuth}
            className="w-full py-3 bg-dark text-white font-semibold rounded-xl hover:bg-text-secondary transition-colors"
          >
            enter →
          </button>
        </div>
      </main>
    );
  }

  // ── DB not set up yet ─────────────────────────────────────
  if (dbError) {
    return (
      <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-4">admin</h1>
        <div className="bg-warning-bg border border-yellow-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-warning mb-2">database not set up yet</p>
          <p className="text-sm text-warning/80 mb-4">
            run the schema SQL in your Supabase project first.
          </p>
          <ol className="text-sm text-warning/80 space-y-1 list-decimal list-inside">
            <li>Go to your Supabase project → SQL Editor</li>
            <li>Click &quot;New query&quot;</li>
            <li>Paste the contents of <code className="font-mono text-xs bg-yellow-100 px-1 rounded">supabase/schema.sql</code></li>
            <li>Click Run</li>
          </ol>
        </div>
      </main>
    );
  }

  // ── Main panel ────────────────────────────────────────────
  const today = questions.find((q) => {
    const pub = new Date(q.published_at).getTime();
    const now = Date.now();
    return pub <= now;
  });

  return (
    <main className="min-h-screen bg-background max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">admin</h1>
        <button onClick={loadQuestions} className="text-xs text-text-muted hover:text-text-secondary">
          refresh
        </button>
      </div>

      {/* Live counts for today's question */}
      {today && liveCounts && (
        <section className="bg-dark rounded-2xl p-5 mb-6 text-white">
          <p className="text-xs text-white/50 uppercase tracking-widest mb-3">live today</p>
          <p className="text-sm font-medium mb-4 text-white/80 line-clamp-1">
            {today.option_a} <span className="text-white/40">or</span> {today.option_b}
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-3xl font-bold text-side-a">{liveCounts.a}</p>
              <p className="text-xs text-white/40 mt-0.5">option a</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-side-b">{liveCounts.b}</p>
              <p className="text-xs text-white/40 mt-0.5">option b</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{liveCounts.total}</p>
              <p className="text-xs text-white/40 mt-0.5">total</p>
            </div>
          </div>
        </section>
      )}

      {/* Post new question */}
      <section className="bg-card border border-border-light rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-bold text-text-primary mb-5">post a question</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              option a
            </label>
            <input
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="e.g. know every secret about someone"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              option b
            </label>
            <input
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="e.g. have everyone know every secret about you"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              dimension
            </label>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as QuestionDimension | "none")}
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary focus:outline-none focus:border-text-secondary transition-colors"
            >
              {DIMENSIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label} — {d.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-2">
              go live
            </label>
            <div className="flex gap-2 mb-2">
              {(["today", "tomorrow", "custom"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setScheduleFor(opt)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    scheduleFor === opt
                      ? "bg-dark text-white border-dark"
                      : "border-border text-text-secondary hover:border-text-secondary"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {scheduleFor === "custom" && (
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary focus:outline-none"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={debateEnabled}
              onChange={(e) => setDebateEnabled(e.target.checked)}
              className="accent-dark"
            />
            enable debates for this question
          </label>

          {postMsg && (
            <p className={`text-sm ${postMsg.ok ? "text-side-a" : "text-error"}`}>
              {postMsg.text}
            </p>
          )}

          <button
            onClick={handlePost}
            disabled={posting || !optionA.trim() || !optionB.trim()}
            className="py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-40 hover:bg-text-secondary transition-colors"
          >
            {posting ? "posting…" : scheduleFor === "today" ? "post now →" : "schedule →"}
          </button>
        </div>
      </section>

      {/* Question queue */}
      <section>
        <h2 className="text-sm font-bold text-text-primary mb-4">
          question queue ({questions.length})
        </h2>

        {loading ? (
          <p className="text-sm text-text-muted">loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-text-muted">no questions yet — post one above</p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => {
              const pub = new Date(q.published_at);
              const isLive = pub.getTime() <= Date.now();
              const isToday = q.id === today?.id;
              return (
                <div
                  key={q.id}
                  className={`rounded-xl px-4 py-3 flex items-start justify-between gap-4 border ${
                    isToday
                      ? "bg-side-a-bg border-side-a/30"
                      : "bg-card border-border-light"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isToday && (
                        <span className="text-[10px] font-bold text-side-a uppercase tracking-wider">
                          live now
                        </span>
                      )}
                      {!isLive && (
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                          scheduled
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {pub.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary font-medium truncate">{q.option_a}</p>
                    <p className="text-sm text-text-secondary truncate">or {q.option_b}</p>
                  </div>
                  <button
                    onClick={() => handleKill(q.id)}
                    className="text-xs text-error hover:text-red-700 font-medium shrink-0 mt-1"
                  >
                    delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
