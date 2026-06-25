"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    async function handle() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.replace("/signin?error=oauth"); return; }
      const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).single();
      router.replace(profile ? "/" : "/onboarding/username");
    }
    handle();
  }, [router]);
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-muted text-sm">signing you in…</p>
    </main>
  );
}
