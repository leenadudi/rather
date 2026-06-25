"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUsername } from "@/lib/server/account";

const SUGGESTIONS = [
  "ghost_42", "anon_user", "mystery91", "quiet_fog", "dusk_wave",
  "still_echo", "pale_drift", "hollow_pine", "open_sky", "calm_brush",
];

function randomSuggestions() {
  return [...SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
}

export default function ChooseUsernamePage() {
  const router = useRouter();
  const [username, setUsernameInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions] = useState(randomSuggestions);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (u.length < 3) { setError("username must be at least 3 characters"); return; }

    setLoading(true);
    setError("");

    const res = await setUsername(u);
    if (res.ok) {
      router.replace("/onboarding/friends");
    } else {
      setError(res.error);
      setLoading(false);
    }
  };

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
              onChange={(e) => { setUsernameInput(e.target.value); setError(""); }}
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
                  onClick={() => setUsernameInput(s)}
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
