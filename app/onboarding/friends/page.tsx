"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { sendFriendRequest, searchUser } from "@/lib/friends";

// Simulated suggested users — in production this could be most-active recent users
const MOCK_SUGGESTIONS = [
  "sophia_m", "jake_k91", "tara_r", "anon_user", "mystery91", "ghost_wave",
];

interface Suggestion {
  username: string;
  streak: number;
  sent: boolean;
}

export default function OnboardingFriendsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/signup"); return; }
      setUserId(data.user.id);

      const { data: u } = await supabase
        .from("users")
        .select("username")
        .eq("id", data.user.id)
        .single();
      setUsername(u?.username ?? null);

      // Get a few real active users as suggestions (random recent voters)
      const { data: active } = await supabase
        .from("users")
        .select("username")
        .neq("id", data.user.id)
        .limit(6);

      if (active && active.length > 0) {
        setSuggestions(
          active.map((u, i) => ({
            username: u.username,
            streak: Math.floor(Math.random() * 20) + 1,
            sent: false,
          }))
        );
      } else {
        setSuggestions(
          MOCK_SUGGESTIONS.map((s, i) => ({
            username: s,
            streak: [12, 8, 21, 5, 3, 15][i] ?? 5,
            sent: false,
          }))
        );
      }
    });
  }, [router]);

  const handleSearch = async () => {
    if (!search.trim() || !userId) return;
    setSearchError(false);
    const found = await searchUser(search.trim());
    if (found) {
      setSearchResult(found.username);
    } else {
      setSearchError(true);
    }
  };

  const handleAdd = async (targetUsername: string) => {
    if (!userId) return;
    const found = await searchUser(targetUsername);
    if (!found) return;
    await sendFriendRequest(userId, found.id);
    setSuggestions((s) =>
      s.map((x) => (x.username === targetUsername ? { ...x, sent: true } : x))
    );
    if (searchResult === targetUsername) setSearchResult(null);
  };

  const inviteLink = `wyr.app/join/${username ?? "you"}`;

  return (
    <main className="min-h-screen bg-background max-w-xl mx-auto px-4 py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-1 w-8 rounded-full bg-border-light" />
        <div className="h-1 flex-1 rounded-full bg-dark" />
        <p className="text-xs text-text-muted ml-2">step 2 of 2</p>
      </div>

      <h1 className="text-3xl font-bold text-text-primary mb-2">add friends (optional)</h1>
      <p className="text-sm text-text-secondary mb-8">
        find people you know — see how they vote and predict each other. you can always do this later.
      </p>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSearchError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="search by username…"
          className="flex-1 text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
        />
        <button
          onClick={handleSearch}
          className="px-5 py-3 bg-dark text-white text-sm font-semibold rounded-xl hover:bg-text-secondary transition-colors"
        >
          find
        </button>
      </div>

      {searchError && (
        <p className="text-xs text-error mb-3">no user found with that username</p>
      )}

      {searchResult && (
        <div className="flex items-center justify-between bg-card border border-border-light rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-side-a-bg flex items-center justify-center text-xs font-bold text-side-a">
              {searchResult.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-text-primary">{searchResult}</span>
          </div>
          <button
            onClick={() => handleAdd(searchResult)}
            className="px-4 py-1.5 bg-dark text-white text-xs font-semibold rounded-lg hover:bg-text-secondary transition-colors"
          >
            add
          </button>
        </div>
      )}

      {/* Invite link */}
      <div className="flex items-center gap-2 px-4 py-3 bg-side-b-bg rounded-xl mb-8">
        <span className="text-side-b text-sm">🔗</span>
        <p className="text-xs text-side-b-dark">
          share your invite link:{" "}
          <span className="font-semibold">{inviteLink}</span>
        </p>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
            people you might know
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {suggestions.map((s) => (
              <div
                key={s.username}
                className="bg-card border border-border-light rounded-2xl px-4 py-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center text-xs font-bold text-text-secondary">
                    {s.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{s.username}</p>
                    <p className="text-[10px] text-text-muted">🔥 {s.streak} day streak</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(s.username)}
                  disabled={s.sent}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    s.sent
                      ? "bg-border-light text-text-muted cursor-default"
                      : "bg-dark text-white hover:bg-text-secondary"
                  }`}
                >
                  {s.sent ? "sent ✓" : "add"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-semibold rounded-xl hover:border-text-secondary transition-colors"
        >
          skip for now
        </button>
        <button
          onClick={() => router.push("/")}
          className="flex-1 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl hover:bg-text-secondary transition-colors"
        >
          done — start voting
        </button>
      </div>
    </main>
  );
}
