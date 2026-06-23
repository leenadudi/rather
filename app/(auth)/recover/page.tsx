"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hashRecoveryCode } from "@/lib/recovery";

type Step = "choose" | "code" | "email" | "reset" | "no-recovery";

export default function RecoverPage() {
  const [step, setStep] = useState<Step>("choose");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const handleCodeSubmit = async () => {
    setLoading(true);
    setError("");
    const hashed = await hashRecoveryCode(code.trim().toUpperCase());
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("recovery_code", hashed)
      .single();

    if (!data) {
      setError("that code doesn't match any account");
      setLoading(false);
      return;
    }
    setUserId(data.id);
    setStep("reset");
    setLoading(false);
  };

  const handleEmailSubmit = async () => {
    setLoading(true);
    setError("");
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("recovery_email", email.trim().toLowerCase())
      .single();

    if (!data) {
      setError("no account found with that email");
      setLoading(false);
      return;
    }
    // In a real app, send a reset link — here we allow direct reset
    setUserId(data.id);
    setStep("reset");
    setLoading(false);
  };

  const handleReset = async () => {
    if (newPw !== confirmPw) { setError("passwords don't match"); return; }
    if (newPw.length < 8) { setError("password must be at least 8 characters"); return; }
    if (!userId) return;
    setLoading(true);
    const { error: e } = await supabase.auth.admin?.updateUserById?.(userId, { password: newPw }) ?? {};
    if (e) { setError("couldn't reset password — try signing in"); setLoading(false); return; }
    setStep("choose");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {step === "choose" && (
          <>
            <h1 className="text-2xl font-bold text-text-primary mb-2">recover your account</h1>
            <p className="text-sm text-text-secondary mb-8">how would you like to recover?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep("code")}
                className="w-full py-4 bg-card border border-border rounded-2xl text-left px-5 hover:border-text-secondary transition-colors"
              >
                <p className="text-sm font-semibold text-text-primary">recovery code</p>
                <p className="text-xs text-text-muted mt-0.5">use your WYR-XXXX-XXXX-XXXX code</p>
              </button>
              <button
                onClick={() => setStep("email")}
                className="w-full py-4 bg-card border border-border rounded-2xl text-left px-5 hover:border-text-secondary transition-colors"
              >
                <p className="text-sm font-semibold text-text-primary">recovery email</p>
                <p className="text-xs text-text-muted mt-0.5">if you added one at signup</p>
              </button>
              <button
                onClick={() => setStep("no-recovery")}
                className="text-sm text-text-muted underline text-center mt-2"
              >
                i don&apos;t have either
              </button>
            </div>
            <Link href="/signin" className="block text-center text-sm text-text-muted mt-6 hover:text-text-secondary underline">
              back to sign in
            </Link>
          </>
        )}

        {step === "code" && (
          <>
            <h2 className="text-xl font-bold text-text-primary mb-6">enter recovery code</h2>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="WYR-XXXX-XXXX-XXXX"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary mb-4 font-mono"
            />
            {error && <p className="text-sm text-error mb-3">{error}</p>}
            <button onClick={handleCodeSubmit} disabled={loading} className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50">
              {loading ? "checking…" : "continue →"}
            </button>
            <button onClick={() => setStep("choose")} className="w-full text-sm text-text-muted mt-3 hover:text-text-secondary underline">back</button>
          </>
        )}

        {step === "email" && (
          <>
            <h2 className="text-xl font-bold text-text-primary mb-6">enter recovery email</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your recovery email"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary mb-4"
            />
            {error && <p className="text-sm text-error mb-3">{error}</p>}
            <button onClick={handleEmailSubmit} disabled={loading} className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50">
              {loading ? "checking…" : "continue →"}
            </button>
            <button onClick={() => setStep("choose")} className="w-full text-sm text-text-muted mt-3 hover:text-text-secondary underline">back</button>
          </>
        )}

        {step === "reset" && (
          <>
            <h2 className="text-xl font-bold text-text-primary mb-6">set a new password</h2>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="new password (8+ chars)"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary mb-3"
            />
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="confirm new password"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary mb-4"
            />
            {error && <p className="text-sm text-error mb-3">{error}</p>}
            <button onClick={handleReset} disabled={loading} className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-50">
              {loading ? "resetting…" : "reset password →"}
            </button>
          </>
        )}

        {step === "no-recovery" && (
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary mb-3">we can&apos;t recover this account</p>
            <p className="text-sm text-text-secondary mb-8">
              without a recovery code or email, there&apos;s no way for us to verify it&apos;s yours. you can start fresh with a new account.
            </p>
            <Link href="/signup" className="block w-full py-3 bg-dark text-white font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors mb-3">
              create a new account
            </Link>
            <Link href="/signin" className="block text-sm text-text-muted hover:text-text-secondary underline">
              try signing in instead
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}
