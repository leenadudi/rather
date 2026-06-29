"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Vote, Debate, Question } from "@/types";

type Tab = "all" | "votes" | "debates";

interface HistoryItem {
  id: string;
  question: Question;
  vote: Vote | null;
  debate: Debate | null;
  date: string;
}

// Blurred ghost rows shown to anon users
const GHOST_QUESTIONS = [
  "would you rather always say what you're thinking…",
  "would you rather know when everyone you love will die…",
  "would you rather be always early or always late…",
  "would you rather have no phone for a month…",
  "would you rather relive your worst memory…",
];

function LockedState() {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8">
      {/* Ghost list */}
      <div className="relative">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">your history</h1>
          <p className="text-sm text-text-secondary mb-6">your votes and debates, saved over time</p>
          <div className="space-y-1 select-none pointer-events-none">
            {GHOST_QUESTIONS.map((q, i) => (
              <div
                key={i}
                className="py-3.5 border-b border-border-light flex items-center justify-between"
                style={{ opacity: 0.15 + i * 0.03 }}
              >
                <p className="text-sm text-text-primary font-medium truncate flex-1 pr-4">{q}</p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-border text-text-muted shrink-0">
                  voted ?
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gate card */}
      <div className="mt-8 lg:mt-12">
        <div className="bg-card border border-border-light rounded-3xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-text-primary mb-3">your history lives here</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6">
            create a free account to save your votes, debates, and character cards — synced across every
            device. your anonymity stays intact.
          </p>

          <div className="space-y-2.5 mb-6 text-left">
            {[
              ["⏱", "Full vote & debate history"],
              ["♦", "Monthly character cards"],
              ["◎", "Friend group & predictions"],
              ["↗", "Shareable result cards"],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 bg-background rounded-xl">
                <span className="text-base">{icon}</span>
                <span className="text-sm font-medium text-text-primary">{label}</span>
              </div>
            ))}
          </div>

          <Link
            href="/signin"
            className="block w-full py-3 bg-dark text-white font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors mb-3"
          >
            create free account
          </Link>
          <p className="text-xs text-text-muted">
            already have one?{" "}
            <Link href="/signin" className="text-side-a hover:underline">
              sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      loadHistory(user.id);
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
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading…</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-background max-w-5xl mx-auto px-4 py-12">
        <LockedState />
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
      <h1 className="text-2xl font-bold text-text-primary mb-1">your history</h1>
      <p className="text-sm text-text-secondary mb-6">your votes and debates, saved over time</p>

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
                  <p className="text-sm text-text-secondary mb-1">
                    {new Date(item.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-text-primary font-medium line-clamp-2">
                    would you rather {q.option_a.toLowerCase()}…
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        item.vote?.choice === "A"
                          ? "bg-side-a-bg text-side-a"
                          : "bg-side-b-bg text-side-b"
                      }`}
                    >
                      voted {item.vote?.choice === "A" ? "a" : "b"}
                    </span>
                    {hasDebate && (
                      <span className="text-xs text-text-muted">debated · 5 min</span>
                    )}
                  </div>
                </div>
                {hasDebate && (
                  <Link
                    href={`/debate/${item.debate!.id}/transcript`}
                    className="text-xs text-side-a underline shrink-0 mt-4"
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
