"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { searchUser, getPendingRequests } from "@/lib/friends";
import { sendFriendRequest, respondToFriendRequest } from "@/lib/server/social";
import { FriendGate } from "@/components/gates/FriendGate";
import type { FriendRequest, User } from "@/types";

export default function FriendsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<User | null | "not-found">(null);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<{ id: string; username: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return; }
      setUserId(data.user.id);

      const [pending, friendData] = await Promise.all([
        getPendingRequests(data.user.id),
        supabase
          .from("friend_requests")
          .select("from_user_id, to_user_id, from_user:users!friend_requests_from_user_id_fkey(username), to_user:users!friend_requests_to_user_id_fkey(username)")
          .or(`from_user_id.eq.${data.user.id},to_user_id.eq.${data.user.id}`)
          .eq("status", "accepted"),
      ]);

      setPendingRequests(pending);
      type FriendRow = { from_user_id: string; to_user_id: string; from_user: { username: string }[] | null; to_user: { username: string }[] | null };
      const flist = (friendData.data as FriendRow[] ?? []).map((r: FriendRow) => {
        const isSelf = r.from_user_id === data.user!.id;
        return {
          id: isSelf ? r.to_user_id : r.from_user_id,
          username: isSelf ? r.to_user?.[0]?.username ?? "" : r.from_user?.[0]?.username ?? "",
        };
      });
      setFriends(flist);
      setLoading(false);
    });
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const result = await searchUser(searchQuery.trim().toLowerCase());
    setSearchResult(result ?? "not-found");
  };

  const handleSendRequest = async (targetId: string) => {
    setSending(true);
    await sendFriendRequest(targetId);
    setSentTo((prev) => [...prev, targetId]);
    setSending(false);
  };

  const handleRespond = async (requestId: string, status: "accepted" | "declined") => {
    await respondToFriendRequest(requestId, status === "accepted");
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (status === "accepted") {
      // Refresh friend list
      window.location.reload();
    }
  };

  if (loading) return <main className="min-h-screen bg-background flex items-center justify-center"><p className="text-text-muted text-sm">loading…</p></main>;

  if (!userId) {
    return (
      <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-8">friends</h1>
        <FriendGate />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-8">friends</h1>

      {/* Search */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-text-secondary mb-2">add a friend by username</p>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="search username"
            className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary"
          />
          <button onClick={handleSearch} className="px-4 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl hover:bg-text-secondary transition-colors">
            search
          </button>
        </div>

        {searchResult === "not-found" && (
          <p className="text-xs text-text-muted mt-2">no user found with that username</p>
        )}
        {searchResult && searchResult !== "not-found" && (
          <div className="mt-3 bg-card border border-border-light rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center text-xs text-text-muted font-medium">
                {searchResult.username[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-text-primary">{searchResult.username}</span>
            </div>
            {searchResult.id === userId ? (
              <span className="text-xs text-text-muted">that&apos;s you</span>
            ) : sentTo.includes(searchResult.id) ? (
              <span className="text-xs text-text-muted">request sent</span>
            ) : (
              <button
                onClick={() => handleSendRequest(searchResult.id)}
                disabled={sending}
                className="text-sm font-semibold text-side-a hover:text-side-a-dark"
              >
                add friend
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-secondary mb-3">friend requests</p>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-card border border-border-light rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center text-xs font-medium text-text-muted">
                    {(req.from_user as { username?: string } | undefined)?.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {(req.from_user as { username?: string } | undefined)?.username ?? "someone"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRespond(req.id, "accepted")} className="text-sm font-semibold text-side-a hover:text-side-a-dark">accept</button>
                  <button onClick={() => handleRespond(req.id, "declined")} className="text-sm text-text-muted hover:text-text-secondary">decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <p className="text-xs font-semibold text-text-secondary mb-3">
          {friends.length} {friends.length === 1 ? "friend" : "friends"}
        </p>
        {friends.length === 0 ? (
          <p className="text-sm text-text-muted py-4">
            no friends yet — search by username to add someone
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.id} className="bg-card border border-border-light rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center text-xs font-medium text-text-muted">
                  {f.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-text-primary">{f.username}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
