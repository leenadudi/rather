"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-2">welcome back</h1>
        <p className="text-sm text-text-secondary mb-8">sign in to your account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">password</label>
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
            className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors mt-2"
          >
            {loading ? "signing in…" : "sign in →"}
          </button>
        </form>

        <div className="flex items-center justify-between mt-6 text-sm text-text-muted">
          <Link href="/recover" className="hover:text-text-secondary underline">
            forgot your username?
          </Link>
          <Link href="/signup" className="hover:text-text-secondary underline">
            create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
