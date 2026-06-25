"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";
import { RecoveryCodeScreen } from "@/components/account/RecoveryCodeScreen";

async function googleSignUp() {
  // Save anon session ID so the callback can migrate votes to the OAuth account.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.is_anonymous) {
    sessionStorage.setItem("wyr_anon_migrate", session.user.id);
  }
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.226 17.64 11.92 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

const SUGGESTIONS = [
  "ghost_42", "anon_user", "mystery91", "quiet_fog", "dusk_wave",
  "still_echo", "pale_drift", "hollow_pine", "open_sky", "calm_brush",
];

function randomSuggestions() {
  return [...SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
}

const FEATURES = [
  {
    icon: "⏱",
    title: "vote history",
    desc: "every question you've ever answered, saved forever",
  },
  {
    icon: "♦",
    title: "character cards",
    desc: "monthly summaries of who you are based on your choices",
  },
  {
    icon: "◎",
    title: "friend groups",
    desc: "see how your friends vote and predict each other",
  },
  {
    icon: "↗",
    title: "shareable cards",
    desc: "share your result and card — friends vote to unlock",
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [suggestions] = useState(randomSuggestions);

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

    // Save anon user ID so we can migrate their votes after account creation.
    const { data: { session: anonSession } } = await supabase.auth.getSession();
    const anonId = anonSession?.user?.is_anonymous ? anonSession.user.id : null;

    const fakeEmail = `${username.trim().toLowerCase()}@wyr.internal`;
    const { data, error: authErr } = await supabase.auth.signUp({ email: fakeEmail, password });

    if (authErr || !data.user) {
      setError(authErr?.message ?? "something went wrong");
      setLoading(false);
      return;
    }

    const newUserId = data.user.id;
    const code = generateRecoveryCode();
    const hashed = await hashRecoveryCode(code);

    await supabase.from("users").insert({
      id: newUserId,
      username: username.trim().toLowerCase(),
      recovery_code: hashed,
    });

    // Migrate any votes/comments from the previous anonymous session.
    if (anonId && anonId !== newUserId) {
      await Promise.all([
        supabase.from("votes").update({ user_id: newUserId }).eq("user_id", anonId),
        supabase.from("comments").update({ user_id: newUserId }).eq("user_id", anonId),
      ]);
    }

    setUserId(newUserId);
    setRecoveryCode(code);
    setLoading(false);
  };

  const handleRecoveryConfirm = async (email?: string) => {
    if (email && userId) {
      await supabase.from("users").update({ recovery_email: email }).eq("id", userId);
    }
    router.push("/onboarding/friends");
  };

  if (recoveryCode) {
    return <RecoveryCodeScreen code={recoveryCode} onConfirm={handleRecoveryConfirm} />;
  }

  return (
    <main className="min-h-screen bg-background flex">
      {/* Left: features */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-12 border-r border-border-light">
        <div className="max-w-sm">
          <h2 className="text-lg font-bold text-text-primary mb-4">create an account to unlock</h2>

          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-border-light rounded-xl p-3">
                <p className="text-base mb-1">{f.icon}</p>
                <p className="text-xs font-semibold text-text-primary mb-0.5">{f.title}</p>
                <p className="text-[11px] text-text-muted leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted">
            🔒 no email required. no tracking. your votes stay anonymous. just a username + password.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-1">create your account</h1>
          <p className="text-sm text-text-secondary mb-6">no email. no real name. totally anonymous.</p>

          {/* OAuth button */}
          <button
            type="button"
            onClick={googleSignUp}
            className="w-full flex items-center justify-center gap-3 py-3 bg-card border border-border rounded-xl text-sm font-medium text-text-primary hover:border-text-secondary transition-colors mb-6"
          >
            <GoogleIcon />
            continue with google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-xs text-text-muted">or use a username</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="pick anything — it's just for you"
                autoFocus
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
              <div className="flex gap-2 mt-2">
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

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                confirm password
              </label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="same as above"
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            {/* Privacy note */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-side-b-bg rounded-xl">
              <svg className="w-3.5 h-3.5 text-side-b shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
              <p className="text-xs text-side-b-dark">
                your username is never shown publicly — only you see it
              </p>
            </div>

            {error && (
              <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors"
            >
              {loading ? "creating account…" : "create account"}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            already have an account?{" "}
            <Link href="/signin" className="text-side-a hover:underline">
              sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
