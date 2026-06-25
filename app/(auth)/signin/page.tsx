"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function googleSignIn() {
  // Save the current anonymous session ID so the callback can migrate votes.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.is_anonymous) {
    sessionStorage.setItem("wyr_anon_migrate", session.user.id);
  }
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export default function SigninPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");

    const fakeEmail = `${username.trim().toLowerCase()}@wyr.internal`;
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (authErr) {
      setError("incorrect username or password");
      setLoading(false);
      return;
    }

    router.push("/");
  };

  return (
    <main className="min-h-screen bg-background flex">
      {/* Left: welcome */}
      <div className="hidden lg:flex flex-col flex-1 justify-center px-12 border-r border-border-light">
        <h1 className="text-3xl font-bold text-text-primary mb-3">welcome back</h1>
        <p className="text-sm text-text-secondary">
          your history, character cards, and friends are waiting.
        </p>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-text-primary mb-6">sign in</h2>

          {/* OAuth button */}
          <button
            onClick={googleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 bg-card border border-border rounded-xl text-sm font-medium text-text-primary hover:border-text-secondary transition-colors mb-6"
          >
            <GoogleIcon />
            continue with google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-xs text-text-muted">or use username</span>
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
                placeholder="your username"
                autoFocus
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="your password"
                className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors mt-1"
            >
              {loading ? "signing in…" : "sign in"}
            </button>
          </form>

          <div className="mt-5 text-sm text-text-muted text-center space-y-2">
            <p>
              <Link href="/recover" className="hover:text-text-secondary underline">
                forgot your username?
              </Link>
            </p>
            <p>
              don&apos;t have an account?{" "}
              <Link href="/signup" className="text-side-a hover:underline">
                create one
              </Link>
            </p>
          </div>
        </div>
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
