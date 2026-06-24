"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Choice } from "@/types";

interface FriendVote {
  userId: string;
  username: string;
  choice: Choice | null;
}

interface Props {
  questionId: string;
  myChoice: Choice | null;
}

export function GroupSidebar({ questionId, myChoice }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [friendVotes, setFriendVotes] = useState<FriendVote[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Choice>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoaded(true); return; }
      const uid = data.user.id;
      setUserId(uid);

      const [userRow, friends] = await Promise.all([
        supabase.from("users").select("username").eq("id", uid).single(),
        supabase
          .from("friend_requests")
          .select(
            "from_user_id, to_user_id, from_user:users!friend_requests_from_user_id_fkey(username), to_user:users!friend_requests_to_user_id_fkey(username)"
          )
          .eq("status", "accepted")
          .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`),
      ]);

      setMyUsername(userRow.data?.username ?? null);

      type FriendRow = {
        from_user_id: string;
        to_user_id: string;
        from_user: { username: string }[] | { username: string } | null;
        to_user: { username: string }[] | { username: string } | null;
      };

      const friendList = (friends.data ?? []).map((f: FriendRow) => {
        const isFrom = f.from_user_id === uid;
        const friendId = isFrom ? f.to_user_id : f.from_user_id;
        const raw = isFrom ? f.to_user : f.from_user;
        const username = Array.isArray(raw) ? raw[0]?.username : (raw as { username: string } | null)?.username;
        return { userId: friendId, username: username ?? "unknown" };
      });

      const friendIds = friendList.map((f) => f.userId);
      const voteMap = new Map<string, Choice>();

      if (friendIds.length > 0) {
        const { data: votes } = await supabase
          .from("votes")
          .select("user_id, choice")
          .eq("question_id", questionId)
          .in("user_id", friendIds);
        for (const v of votes ?? []) voteMap.set(v.user_id, v.choice as Choice);
      }

      setFriendVotes(
        friendList.map((f) => ({ ...f, choice: voteMap.get(f.userId) ?? null }))
      );

      const { data: preds } = await supabase
        .from("predictions")
        .select("target_id, predicted_choice")
        .eq("predictor_id", uid)
        .eq("question_id", questionId);

      const predsMap: Record<string, Choice> = {};
      for (const p of preds ?? []) predsMap[p.target_id] = p.predicted_choice as Choice;
      setPredictions(predsMap);

      setLoaded(true);
    });
  }, [questionId]);

  const handlePredict = async (targetId: string, choice: Choice) => {
    if (!userId) return;
    await supabase.from("predictions").upsert(
      { predictor_id: userId, target_id: targetId, question_id: questionId, predicted_choice: choice },
      { onConflict: "predictor_id,target_id,question_id" }
    );
    setPredictions((p) => ({ ...p, [targetId]: choice }));
  };

  if (!loaded) return null;

  if (!userId) {
    return (
      <div className="bg-card border border-border-light rounded-2xl p-5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          your group
        </p>
        <p className="text-xs text-text-muted mb-4">sign in to see how your friends vote</p>
        <Link
          href="/signin"
          className="block text-center py-2 bg-dark text-white text-xs font-semibold rounded-xl hover:bg-text-secondary transition-colors"
        >
          sign in
        </Link>
      </div>
    );
  }

  const countA = friendVotes.filter((f) => f.choice === "A").length;
  const countB = friendVotes.filter((f) => f.choice === "B").length;
  const votedCount = countA + countB;
  const unvotedFriends = friendVotes.filter((f) => !f.choice);

  return (
    <div className="space-y-4">
      {/* Your group */}
      <div className="bg-card border border-border-light rounded-2xl p-5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
          your group{votedCount > 0 ? ` · ${votedCount} voted` : ""}
        </p>

        {friendVotes.length === 0 ? (
          <p className="text-xs text-text-muted">
            <Link href="/friends" className="text-side-a hover:underline">
              add friends
            </Link>{" "}
            to see how they vote
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <div
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 ${
                  countA > 0 ? "bg-side-a-bg" : "bg-border-light"
                }`}
              >
                <span
                  className={`text-xl font-bold ${countA > 0 ? "text-side-a" : "text-text-muted"}`}
                >
                  {countA}
                </span>
                <span
                  className={`text-xs ${countA > 0 ? "text-side-a" : "text-text-muted"}`}
                >
                  chose A
                </span>
              </div>
              <div
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 ${
                  countB > 0 ? "bg-side-b-bg" : "bg-border-light"
                }`}
              >
                <span
                  className={`text-xl font-bold ${countB > 0 ? "text-side-b" : "text-text-muted"}`}
                >
                  {countB}
                </span>
                <span
                  className={`text-xs ${countB > 0 ? "text-side-b" : "text-text-muted"}`}
                >
                  chose B
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {friendVotes.map((f) => (
                <div key={f.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-border-light flex items-center justify-center text-[10px] font-bold text-text-secondary">
                      {f.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-text-primary">{f.username}</span>
                  </div>
                  {f.choice ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        f.choice === "A"
                          ? "bg-side-a-bg text-side-a"
                          : "bg-side-b-bg text-side-b"
                      }`}
                    >
                      chose {f.choice.toLowerCase()}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">hasn&apos;t voted</span>
                  )}
                </div>
              ))}

              {/* You */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-dark flex items-center justify-center text-[10px] font-bold text-white">
                    {myUsername ? myUsername.slice(0, 2).toUpperCase() : "YO"}
                  </div>
                  <span className="text-xs font-medium text-text-primary">you</span>
                </div>
                {myChoice ? (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      myChoice === "A"
                        ? "bg-side-a-bg text-side-a"
                        : "bg-side-b-bg text-side-b"
                    }`}
                  >
                    chose {myChoice.toLowerCase()}
                  </span>
                ) : (
                  <span className="text-xs text-text-muted">hasn&apos;t voted</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Predict your friends */}
      {unvotedFriends.length > 0 && (
        <div className="bg-card border border-border-light rounded-2xl p-5">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
            predict your friends
          </p>
          <p className="text-xs text-text-muted mb-4">guess what each friend chose</p>
          <div className="space-y-2.5">
            {unvotedFriends.map((f) => (
              <div key={f.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-border-light flex items-center justify-center text-[10px] font-bold text-text-secondary">
                    {f.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-text-primary">{f.username}</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handlePredict(f.userId, "A")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      predictions[f.userId] === "A"
                        ? "bg-side-a text-white"
                        : "bg-side-a-bg text-side-a hover:bg-side-a/20"
                    }`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => handlePredict(f.userId, "B")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      predictions[f.userId] === "B"
                        ? "bg-side-b text-white"
                        : "bg-side-b-bg text-side-b hover:bg-side-b/20"
                    }`}
                  >
                    B
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
