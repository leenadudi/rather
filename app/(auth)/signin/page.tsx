"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setUsername } from "@/lib/server/account";
import { usernameToEmail } from "@/lib/usernameAuth";

type Mode = "create" | "signin";

export default function SigninPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [username, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // email magic-link state
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function handleUsernamePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      setError("username must be 3–20 characters: letters, numbers, or _");
      return;
    }
    if (password.length < 6) {
      setError("password must be at least 6 characters");
      return;
    }

    setBusy(true);
    const synthEmail = usernameToEmail(u);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: synthEmail, password });
      if (error) {
        setError("wrong username or password");
        setBusy(false);
        return;
      }
      router.replace("/");
      return;
    }

    // create account
    const { data, error } = await supabase.auth.signUp({ email: synthEmail, password });
    if (error) {
      setError(/already registered/i.test(error.message) ? "that username is taken — try another" : error.message);
      setBusy(false);
      return;
    }
    // No session means email confirmation is still enabled in Supabase — with a
    // synthetic address the account can never be confirmed.
    if (!data.session) {
      setError("account confirmation is enabled — disable “Confirm email” in Supabase to use username sign-up");
      setBusy(false);
      return;
    }
    // Claim the username for this account.
    const res = await setUsername(u);
    if (!res.ok) {
      setError(res.code === "username_taken" ? "that username is taken — try another" : res.error);
      await supabase.auth.signOut();
      setBusy(false);
      return;
    }
    router.replace("/");
  }

  async function continueWithGoogle() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setError(error.message);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-1">
          {mode === "create" ? "create your account" : "welcome back"}
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          {mode === "create"
            ? "just a username and password — no email needed. unlock debates, friends, and your streak."
            : "sign in with your username and password."}
        </p>

        {/* mode toggle */}
        <div className="flex gap-1 p-1 bg-card border border-border-light rounded-xl mb-5">
          {(["create", "signin"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                mode === m ? "bg-dark text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {m === "create" ? "create account" : "sign in"}
            </button>
          ))}
        </div>

        <form onSubmit={handleUsernamePassword} className="flex flex-col gap-3 mb-6">
          <input
            value={username}
            onChange={(e) => { setUsernameInput(e.target.value); setError(""); }}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="password"
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors"
          >
            {busy ? "…" : mode === "create" ? "create account" : "sign in"}
          </button>
        </form>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border-light" />
          <span className="text-xs text-text-muted">or use email / google</span>
          <div className="flex-1 h-px bg-border-light" />
        </div>

        <button onClick={continueWithGoogle} className="w-full flex items-center justify-center gap-3 py-3 bg-card border border-border rounded-xl text-sm font-medium text-text-primary hover:border-text-secondary transition-colors mb-4">
          <GoogleIcon /> continue with google
        </button>

        {sent ? (
          <p className="text-sm text-text-secondary bg-card border border-border-light rounded-xl px-4 py-3">check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors" />
            <button type="submit" className="w-full py-3 bg-card border border-border text-text-primary font-semibold rounded-xl hover:border-text-secondary transition-colors">email me a link</button>
          </form>
        )}

        {error && <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl mt-4">{error}</p>}
      </div>
    </main>
  );
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
