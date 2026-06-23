"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { HistoryGate } from "@/components/gates/HistoryGate";
import type { Vote, Debate, Question } from "@/types";

type Tab = "all" | "votes" | "debates";

interface HistoryItem {
  id: string;
  question: Question;
  vote: Vote | null;
  debate: Debate | null;
  date: string;
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return; }
      setUserId(data.user.id);
      loadHistory(data.user.id);
    });
  }, []);

  async function loadHistory(uid: string) {
    const { data: votes } = await supabase
      .from("votes")
      .select("*, questions(*)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: debates } = await supabase
      .from("debates")
      .select("*, questions(*)")
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
      .in("status", ["ended", "flagged"])
      .order("ended_at", { ascending: false })
      .limit(50);

    const debateByQ = new Map<string, Debate>();
    for (const d of debates ?? []) debateByQ.set(d.question_id, d);

    type VoteRow = Vote & { questions: Question };
    const merged: HistoryItem[] = (votes ?? []).map((v: VoteRow) => ({
      id: v.id,
      question: v.questions as Question,
      vote: v as Vote,
      debate: debateByQ.get(v.question_id) ?? null,
      date: v.created_at,
    }));

    setItems(merged);
    setLoading(false);
  }

  if (loading) {
    return <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-muted text-sm">loading…</p>
    </main>;
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-8">your history</h1>
        <HistoryGate />
      </main>
    );
  }

  const filtered = items.filter((item) => {
    if (tab === "votes") return !!item.vote && !item.debate;
    if (tab === "debates") return !!item.debate;
    return true;
  });

  return (
    <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-6">your history</h1>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "votes", "debates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? "bg-dark text-white" : "text-text-secondary hover:bg-border-light"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">nothing here yet</p>
      ) : (
        <div className="divide-y divide-border-light">
          {filtered.map((item) => {
            if (!item.question) return null;
            const q = item.question;
            const hasDebate = !!item.debate;

            return (
              <div key={item.id} className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium truncate">
                    {q.option_a} or {q.option_b}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      item.vote?.choice === "A" ? "bg-side-a-bg text-side-a-dark" : "bg-side-b-bg text-side-b-dark"
                    }`}>
                      {item.vote?.choice === "A" ? "a" : "b"}
                    </span>
                    {hasDebate && (
                      <span className="text-xs text-text-muted">debated · 5 min</span>
                    )}
                    <span className="text-xs text-text-muted">
                      {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
                {hasDebate && (
                  <Link
                    href={`/debate/${item.debate!.id}/transcript`}
                    className="text-xs text-side-a underline shrink-0"
                  >
                    view
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
