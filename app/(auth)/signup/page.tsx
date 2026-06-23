"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";
import { RecoveryCodeScreen } from "@/components/account/RecoveryCodeScreen";

const SUGGESTIONS = [
  "ghost_maple", "anon_river", "quiet_fog", "dusk_wave", "still_echo",
  "pale_drift", "hollow_pine", "open_sky", "calm_brush", "vague_light",
];

function randomSuggestions() {
  const shuffled = [...SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [suggestions] = useState(randomSuggestions());

  const validate = () => {
    if (!username.trim()) return "username is required";
    if (username.length < 3) return "username must be at least 3 characters";
    if (password.length < 8) return "password must be at least 8 characters";
    if (password !== confirmPw) return "passwords don't match";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError("");

    // Check username uniqueness
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .single();

    if (existing) {
      setError("that username is taken — try another");
      setLoading(false);
      return;
    }

    // Create Supabase auth user (use username as email placeholder)
    const fakeEmail = `${username.trim().toLowerCase()}@wyr.internal`;
    const { data, error: authErr } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
    });

    if (authErr || !data.user) {
      setError(authErr?.message ?? "something went wrong");
      setLoading(false);
      return;
    }

    const code = generateRecoveryCode();
    const hashed = await hashRecoveryCode(code);

    await supabase.from("users").insert({
      id: data.user.id,
      username: username.trim().toLowerCase(),
      recovery_code: hashed,
    });

    setUserId(data.user.id);
    setRecoveryCode(code);
    setLoading(false);
  };

  const handleRecoveryConfirm = async (email?: string) => {
    if (email && userId) {
      await supabase.from("users").update({ recovery_email: email }).eq("id", userId);
    }
    router.push("/");
  };

  if (recoveryCode) {
    return <RecoveryCodeScreen code={recoveryCode} onConfirm={handleRecoveryConfirm} />;
  }

  return (
    <main className="min-h-screen bg-background flex">
      {/* Left: today's question preview */}
      <div className="hidden lg:flex flex-1 items-center justify-center px-12 border-r border-border-light">
        <div className="max-w-sm text-center">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">
            today&apos;s question
          </p>
          <p className="text-2xl font-bold text-text-primary mb-6">
            would you rather know every secret about someone, or have everyone know every secret about you?
          </p>
          <div className="flex gap-2">
            <div className="flex-1 h-8 bg-side-a-bg rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-side-a">61%</span>
            </div>
            <div className="flex-1 h-8 bg-side-b-bg rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-side-b">39%</span>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">12,847 votes</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-2">create an account</h1>
          <p className="text-sm text-text-secondary mb-8">no email required · username is private</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="choose a username"
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
              <div className="flex gap-2 mt-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUsername(s)}
                    className="text-xs text-text-muted border border-border-light px-2.5 py-1 rounded-full hover:border-text-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">confirm password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="repeat password"
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors mt-2"
            >
              {loading ? "creating account…" : "create account →"}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            already have one?{" "}
            <Link href="/signin" className="text-text-secondary underline">
              sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
