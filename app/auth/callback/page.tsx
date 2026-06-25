"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      // Wait for Supabase to exchange the OAuth code for a session.
      // The client detects the fragment/code in the URL automatically.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/signin?error=oauth");
        return;
      }

      const userId = session.user.id;

      // Migrate any votes/comments that were stored under a previous anonymous
      // session (saved in sessionStorage before the OAuth redirect).
      const anonId = sessionStorage.getItem("wyr_anon_migrate");
      if (anonId && anonId !== userId) {
        await Promise.all([
          supabase.from("votes").update({ user_id: userId }).eq("user_id", anonId),
          supabase.from("comments").update({ user_id: userId }).eq("user_id", anonId),
        ]);
        sessionStorage.removeItem("wyr_anon_migrate");
      }

      // Check if this user has picked a username yet.
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (!userRow) {
        router.replace("/onboarding/username");
      } else {
        router.replace("/");
      }
    }

    handleCallback();
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-muted text-sm">signing you in…</p>
    </main>
  );
}
