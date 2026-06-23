"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Question, QuestionDimension } from "@/types";

const DIMENSIONS: QuestionDimension[] = [
  "honesty_vs_tact", "autonomy_vs_belonging", "experience_vs_security",
  "clarity_vs_kindness", "individual_vs_social", "present_vs_future",
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  // New question form
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [dimension, setDimension] = useState<QuestionDimension>("honesty_vs_tact");
  const [publishAt, setPublishAt] = useState("");
  const [debateEnabled, setDebateEnabled] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState("");

  const [liveCounts, setLiveCounts] = useState<{ a: number; b: number; total: number } | null>(null);

  const handleAuth = () => {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || pw === "admin123") {
      setAuthed(true);
      loadQuestions();
    } else {
      setPwError(true);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(20);
    setQuestions((data ?? []) as Question[]);

    // Load live counts for most recent question
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
    if (!optionA.trim() || !optionB.trim() || !publishAt) {
      setPostMsg("fill in all fields");
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("questions").insert({
      option_a: optionA.trim(),
      option_b: optionB.trim(),
      dimension,
      debate_enabled: debateEnabled,
      published_at: new Date(publishAt).toISOString(),
    });
    if (error) {
      setPostMsg(`error: ${error.message}`);
    } else {
      setPostMsg("question posted ✓");
      setOptionA(""); setOptionB(""); setPublishAt("");
      loadQuestions();
    }
    setPosting(false);
  };

  const handleKill = async (id: string) => {
    if (!confirm("pull this question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    loadQuestions();
  };

  if (!authed) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-xs">
          <h1 className="text-xl font-bold text-text-primary mb-6">admin</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="admin password"
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none mb-3"
          />
          {pwError && <p className="text-xs text-error mb-3">incorrect password</p>}
          <button onClick={handleAuth} className="w-full py-3 bg-dark text-white font-semibold rounded-xl hover:bg-text-secondary transition-colors">
            enter
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-8">admin panel</h1>

      {/* Post question */}
      <section className="bg-card border border-border-light rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-bold text-text-primary mb-4">post a question</h2>
        <div className="flex flex-col gap-3">
          <input value={optionA} onChange={(e) => setOptionA(e.target.value)} placeholder="option a text" className="text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none" />
          <input value={optionB} onChange={(e) => setOptionB(e.target.value)} placeholder="option b text" className="text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none" />
          <select value={dimension} onChange={(e) => setDimension(e.target.value as QuestionDimension)} className="text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary focus:outline-none">
            {DIMENSIONS.map((d) => <option key={d} value={d}>{d.replace(/_/g, " vs ").replace("_vs_", " vs ")}</option>)}
          </select>
          <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary focus:outline-none" />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={debateEnabled} onChange={(e) => setDebateEnabled(e.target.checked)} className="accent-dark" />
            enable debates
          </label>
          {postMsg && <p className={`text-sm ${postMsg.startsWith("error") ? "text-error" : "text-side-a"}`}>{postMsg}</p>}
          <button onClick={handlePost} disabled={posting} className="py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors">
            {posting ? "posting…" : "post question"}
          </button>
        </div>
      </section>

      {/* Live counts */}
      {liveCounts && questions[0] && (
        <section className="bg-card border border-border-light rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-bold text-text-primary mb-3">live votes — today</h2>
          <p className="text-xs text-text-secondary mb-3 truncate">{questions[0].option_a} or {questions[0].option_b}</p>
          <div className="flex gap-6">
            <div><p className="text-2xl font-bold text-side-a">{liveCounts.a}</p><p className="text-xs text-text-muted">option a</p></div>
            <div><p className="text-2xl font-bold text-side-b">{liveCounts.b}</p><p className="text-xs text-text-muted">option b</p></div>
            <div><p className="text-2xl font-bold text-text-primary">{liveCounts.total}</p><p className="text-xs text-text-muted">total</p></div>
          </div>
        </section>
      )}

      {/* Question queue */}
      <section>
        <h2 className="text-sm font-bold text-text-primary mb-4">question queue</h2>
        {loading ? (
          <p className="text-sm text-text-muted">loading…</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="bg-card border border-border-light rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-muted mb-1">
                    {new Date(q.published_at).toLocaleString()} · {q.dimension?.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-text-primary truncate">{q.option_a}</p>
                  <p className="text-sm text-text-secondary truncate">or {q.option_b}</p>
                </div>
                <button onClick={() => handleKill(q.id)} className="text-xs text-error hover:text-red-700 font-medium shrink-0">
                  pull
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
