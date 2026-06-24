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
    <main className="min-h-screen bg-background flex">
      {/* Left: question preview + welcome */}
      <div className="hidden lg:flex flex-col flex-1 justify-center px-12 border-r border-border-light">
        {/* Mini question card */}
        <div className="bg-card border border-border-light rounded-2xl overflow-hidden mb-8 max-w-sm opacity-70">
          <div className="px-4 py-2.5 border-b border-border-light">
            <span className="text-xs text-text-muted">today&apos;s question</span>
          </div>
          <div className="flex min-h-[80px]">
            <div className="flex-1 p-4 bg-side-a-bg/40">
              <p className="text-xs font-medium text-text-secondary">always say exactly what you&apos;re thinking</p>
            </div>
            <div className="w-8 flex items-center justify-center border-x border-border-light">
              <span className="text-[10px] text-text-muted">or</span>
            </div>
            <div className="flex-1 p-4">
              <p className="text-xs font-medium text-text-secondary">never be able to say what you mean</p>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-text-primary mb-3">welcome back</h1>
        <p className="text-sm text-text-secondary">
          your history, character cards, and friends are waiting.
        </p>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-text-primary mb-8">sign in</h2>

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
