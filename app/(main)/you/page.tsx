"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildCharacterCard } from "@/lib/character";
import { CharacterCard } from "@/components/character/CharacterCard";
import { CharacterProgress } from "@/components/character/CharacterProgress";
import Link from "next/link";
import type { CharacterCard as TCard } from "@/types";

export default function YouPage() {
  const [card, setCard] = useState<TCard | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return; }
      setUserId(data.user.id);

      const now = new Date();
      const [built, votes] = await Promise.all([
        buildCharacterCard(data.user.id, now.getFullYear(), now.getMonth() + 1),
        supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.user.id)
          .gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      ]);

      setCard(built);
      setVoteCount(votes.count ?? 0);
      setLoading(false);
    });
  }, []);

  if (loading) return <main className="min-h-screen bg-background flex items-center justify-center"><p className="text-text-muted text-sm">loading…</p></main>;

  if (!userId) {
    return (
      <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-4">your character</h1>
        <p className="text-sm text-text-secondary mb-6">
          create an account to build your character card over time
        </p>
        <Link href="/signup" className="block w-full py-3 bg-dark text-white font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors">
          create free account
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-8">your character</h1>
      {card ? (
        <CharacterCard card={card} />
      ) : (
        <CharacterProgress voteCount={voteCount} />
      )}
    </main>
  );
}
