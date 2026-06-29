"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCommunityFeed, getCommunityStats } from "@/lib/community";
import { CommunityCard } from "@/components/community/CommunityCard";
import { SubmitModal } from "@/components/community/SubmitModal";
import type { CommunityQuestion, CommunitySort, CommunityStats } from "@/types";

const FILTERS: { key: CommunitySort; label: string; icon: string }[] = [
  { key: "trending", label: "trending", icon: "🔥" },
  { key: "new", label: "new", icon: "✨" },
  { key: "top", label: "top all time", icon: "🏆" },
];

function ExploreContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [sort, setSort] = useState<CommunitySort>("trending");
  const [feed, setFeed] = useState<CommunityQuestion[]>([]);
  const [stats, setStats] = useState<CommunityStats>({ submitted: 0, live: 0, total_votes: 0 });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(params.get("submit") === "1");

  const load = useCallback(async (uid: string | null, s: CommunitySort) => {
    setLoading(true);
    const [f, st] = await Promise.all([
      getCommunityFeed(s, uid),
      uid ? getCommunityStats(uid) : Promise.resolve({ submitted: 0, live: 0, total_votes: 0 }),
    ]);
    setFeed(f);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? null;
      setUserId(uid);
      load(uid, sort);
    });
    // Open the submit modal when the navbar button fires its event.
    const open = () => setShowSubmit(true);
    window.addEventListener("wyr:submit", open);
    return () => window.removeEventListener("wyr:submit", open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeSort = (s: CommunitySort) => {
    setSort(s);
    load(userId, s);
  };

  // Top community questions for the "trending today" rail.
  const trendingRail = [...feed]
    .sort((a, b) => b.counts.total - a.counts.total)
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="lg:grid lg:grid-cols-[240px_1fr_300px] lg:gap-6 space-y-6 lg:space-y-0">

          {/* ── Left sidebar ── */}
          <aside className="hidden lg:block space-y-6">
            <div>
              <h1 className="text-xl font-bold text-text-primary">explore</h1>
              <p className="text-xs text-text-muted mt-0.5">community questions</p>
            </div>

            <div className="space-y-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => changeSort(f.key)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    sort === f.key
                      ? "bg-dark text-white"
                      : "bg-card border border-border-light text-text-secondary hover:border-border"
                  }`}
                >
                  <span>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">your stats</p>
              <Stat value={stats.submitted.toLocaleString()} label="submitted" />
              <Stat value={stats.live.toLocaleString()} label="currently live" />
              <Stat value={compact(stats.total_votes)} label="total votes received" />
            </div>
          </aside>

          {/* ── Center feed ── */}
          <div className="space-y-4">
            {/* Mobile filter row */}
            <div className="flex gap-2 lg:hidden overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => changeSort(f.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    sort === f.key ? "bg-dark text-white" : "bg-card border border-border-light text-text-secondary"
                  }`}
                >
                  <span>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-text-muted py-12 text-center">loading questions…</p>
            ) : feed.length === 0 ? (
              <div className="bg-card border border-border-light rounded-2xl p-10 text-center">
                <p className="text-sm font-medium text-text-primary mb-1">no community questions yet</p>
                <p className="text-xs text-text-muted mb-5">be the first to submit one</p>
                <button
                  onClick={() => setShowSubmit(true)}
                  className="px-5 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl hover:bg-text-secondary transition-colors"
                >
                  write a question →
                </button>
              </div>
            ) : (
              feed.map((q) => <CommunityCard key={q.id} question={q} userId={userId} />)
            )}
          </div>

          {/* ── Right sidebar ── */}
          <aside className="hidden lg:block space-y-4">
            {trendingRail.length > 0 && (
              <div className="bg-card border border-border-light rounded-2xl p-5">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">trending today</p>
                <div className="space-y-3">
                  {trendingRail.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => router.push(`/explore/${q.id}`)}
                      className="w-full flex items-center gap-3 text-left group"
                    >
                      <p className="text-xs text-text-secondary leading-snug flex-1 line-clamp-2 group-hover:text-text-primary transition-colors">
                        {q.option_a.toLowerCase()} or {q.option_b.toLowerCase()}
                      </p>
                      <span className="text-xs font-semibold text-text-muted shrink-0">
                        {compact(q.counts.total)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </aside>
        </div>
      </div>

      {/* Mobile submit FAB */}
      <button
        onClick={() => setShowSubmit(true)}
        className="lg:hidden fixed bottom-24 right-5 z-30 px-5 py-3 bg-dark text-white text-sm font-semibold rounded-full shadow-lg"
      >
        + submit a wyr
      </button>

      {showSubmit && (
        <SubmitModal
          onClose={() => setShowSubmit(false)}
        />
      )}
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-text-primary leading-none">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString();
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading…</p>
      </main>
    }>
      <ExploreContent />
    </Suspense>
  );
}
