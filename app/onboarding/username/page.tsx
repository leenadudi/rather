"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";
import { RecoveryCodeScreen } from "@/components/account/RecoveryCodeScreen";

const SUGGESTIONS = [
  "ghost_42", "anon_user", "mystery91", "quiet_fog", "dusk_wave",
  "still_echo", "pale_drift", "hollow_pine", "open_sky", "calm_brush",
];

function randomSuggestions() {
  return [...SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
}

export default function ChooseUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions] = useState(randomSuggestions);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (u.length < 3) { setError("username must be at least 3 characters"); return; }

    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/signin"); return; }

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", u)
      .single();

    if (existing) {
      setError("that username is taken — try another");
      setLoading(false);
      return;
    }

    // OAuth users still need a recovery code: it's the only account-recovery
    // path that doesn't depend on the OAuth provider, and the column is
    // NOT NULL. Mirror the signup flow so the row inserts cleanly.
    const code = generateRecoveryCode();
    const hashed = await hashRecoveryCode(code);

    const { error: insertErr } = await supabase
      .from("users")
      .insert({ id: user.id, username: u, recovery_code: hashed });

    if (insertErr) {
      // 23505 = unique violation (someone claimed the name between check and insert).
      setError(
        insertErr.code === "23505"
          ? "that username is taken — try another"
          : "couldn't save username — try again"
      );
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setRecoveryCode(code);
    setLoading(false);
  };

  const handleRecoveryConfirm = async (email?: string) => {
    if (email && userId) {
      await supabase.from("users").update({ recovery_email: email }).eq("id", userId);
    }
    router.replace("/onboarding/friends");
  };

  if (recoveryCode) {
    return <RecoveryCodeScreen code={recoveryCode} onConfirm={handleRecoveryConfirm} />;
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-1">pick a username</h1>
        <p className="text-sm text-text-secondary mb-7">
          anonymous. only you see it. used to find friends on the app.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="pick anything — it's just for you"
              autoFocus
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs text-text-muted mt-1">suggestions:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setUsername(s)}
                  className="text-xs text-text-secondary border border-border-light px-2.5 py-1 rounded-full hover:border-text-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors"
          >
            {loading ? "saving…" : "continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
