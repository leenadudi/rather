"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function continueWithGoogle() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    // Anonymous user → link in place (keeps id + data). Otherwise sign in.
    const fn = user?.is_anonymous
      ? supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
      : supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    const { error } = await fn;
    if (error) setError(error.message);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    // Anonymous → attach email in place; else send a normal OTP sign-in link.
    const { error } = user?.is_anonymous
      ? await supabase.auth.updateUser({ email })
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-1">save your account</h2>
        <p className="text-sm text-text-secondary mb-6">keep your votes, character cards, and friends across devices.</p>

        <button onClick={continueWithGoogle} className="w-full flex items-center justify-center gap-3 py-3 bg-card border border-border rounded-xl text-sm font-medium text-text-primary hover:border-text-secondary transition-colors mb-6">
          <GoogleIcon /> continue with google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border-light" /><span className="text-xs text-text-muted">or email me a link</span><div className="flex-1 h-px bg-border-light" />
        </div>

        {sent ? (
          <p className="text-sm text-text-secondary bg-card border border-border-light rounded-xl px-4 py-3">check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors" />
            <button type="submit" className="w-full py-3 bg-dark text-white font-semibold rounded-xl hover:bg-text-secondary transition-colors">email me a link</button>
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
