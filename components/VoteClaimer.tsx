"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { pendingClaims, markClaimed } from "@/lib/localVotes";
import { claimAnonymousVotes } from "@/lib/server/votes";

// When a visitor signs up, the answers they gave beforehand live only in this
// browser's localStorage (as anonymous vote rows). Once they're authenticated we
// reassign those rows to their account so their first answer is saved + counts
// toward their streak. Runs on load and on sign-in; no-op when there's nothing
// pending or no session.
export function VoteClaimer() {
  useEffect(() => {
    let done = false;

    async function claim() {
      if (done) return;
      const pending = pendingClaims();
      if (pending.length === 0) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      done = true;
      const res = await claimAnonymousVotes(pending.map((p) => p.voteId));
      if (res.ok) pending.forEach((p) => markClaimed(p.questionId));
    }

    claim();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") claim();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
