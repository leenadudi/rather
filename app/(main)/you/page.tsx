"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { buildCharacterCard } from "@/lib/character";
import { CharacterCard } from "@/components/character/CharacterCard";
import { CharacterProgress } from "@/components/character/CharacterProgress";
import type { CharacterCard as TCard } from "@/types";

interface PastCard {
  month: string;       // e.g. "may 2026"
  year: number;
  monthNum: number;
  card: TCard | null;
  votes: number;
}

const BORDER_COLORS = ["#378ADD", "#7F77DD", "#4ADE80", "#F59E0B"];

export default function YouPage() {
  const [currentCard, setCurrentCard] = useState<TCard | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [pastCards, setPastCards] = useState<PastCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return; }
      const uid = data.user.id;
      setUserId(uid);

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [built, votesRes] = await Promise.all([
        buildCharacterCard(uid, year, month),
        supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", uid)
          .gte("created_at", new Date(year, month - 1, 1).toISOString()),
      ]);

      setCurrentCard(built);
      setVoteCount(votesRes.count ?? 0);

      // Fetch past 4 months
      const past: PastCard[] = [];
      for (let i = 1; i <= 4; i++) {
        const d = new Date(year, month - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const monthStr = d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toLowerCase();

        const [pastBuilt, pastVotes] = await Promise.all([
          buildCharacterCard(uid, y, m),
          supabase
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("user_id", uid)
            .gte("created_at", new Date(y, m - 1, 1).toISOString())
            .lt("created_at", new Date(y, m, 1).toISOString()),
        ]);

        past.push({
          month: monthStr,
          year: y,
          monthNum: m,
          card: pastBuilt,
          votes: pastVotes.count ?? 0,
        });
      }

      setPastCards(past.filter((p) => p.votes > 0));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading…</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">♦</div>
          <h1 className="text-2xl font-bold text-text-primary mb-3">your character</h1>
          <p className="text-sm text-text-secondary mb-6">
            create an account to build your character card — a monthly portrait of who you are based on
            your choices.
          </p>
          <Link
            href="/signup"
            className="block w-full py-3 bg-dark text-white font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors mb-3"
          >
            create free account
          </Link>
          <Link href="/signin" className="text-sm text-text-muted hover:text-text-secondary underline">
            already have one? sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
      {/* Current month card */}
      {currentCard ? (
        <CharacterCard card={currentCard} />
      ) : (
        <CharacterProgress voteCount={voteCount} />
      )}

      {/* Past months */}
      {pastCards.length > 0 && (
        <div className="mt-10">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
            past months
          </p>
          <div className="grid grid-cols-2 gap-3">
            {pastCards.map((p, i) => (
              <div
                key={`${p.year}-${p.monthNum}`}
                className="bg-card border-l-4 rounded-xl px-4 py-4"
                style={{ borderLeftColor: BORDER_COLORS[i % BORDER_COLORS.length] }}
              >
                <p className="text-xs text-text-muted mb-1">{p.month}</p>
                {p.card ? (
                  <>
                    <p className="text-sm font-bold text-text-primary leading-snug mb-2">
                      {p.card.headline}
                    </p>
                    <p className="text-xs text-text-muted">{p.votes} votes</p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">not enough data</p>
                )}
                <button className="text-xs text-text-secondary mt-2 hover:text-text-primary">
                  share →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
