"use client";

import { useState } from "react";

interface Props {
  code: string;
  onConfirm: (email?: string) => void;
}

export function RecoveryCodeScreen({ code, onConfirm }: Props) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center px-4 z-50">
      <div className="max-w-sm w-full bg-card rounded-3xl border border-border-light p-8 shadow-lg text-center">
        <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-xl">🔑</span>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">save your recovery code</h2>
        <p className="text-sm text-text-secondary mb-6">
          this is the only way to recover your account — we can&apos;t look it up for you
        </p>

        {/* Code display */}
        <div className="bg-background rounded-2xl border border-border px-6 py-4 mb-4">
          <p className="text-2xl font-mono font-bold text-text-primary tracking-widest">{code}</p>
        </div>

        <button
          onClick={copyCode}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:border-text-secondary transition-colors mb-6"
        >
          {copied ? "✓ copied" : "copy code"}
        </button>

        <p className="text-xs text-text-muted mb-2 text-left">recovery email (optional)</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="add a backup email address"
          className="w-full text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary mb-6"
        />

        <label className="flex items-start gap-3 text-left mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-dark"
          />
          <span className="text-xs text-text-secondary">
            i&apos;ve saved my recovery code in a safe place
          </span>
        </label>

        <button
          onClick={() => confirmed && onConfirm(email || undefined)}
          disabled={!confirmed}
          className="w-full py-3 bg-dark text-white font-semibold rounded-xl disabled:opacity-40 hover:bg-text-secondary transition-colors"
        >
          i&apos;ve saved it — let&apos;s go →
        </button>
      </div>
    </div>
  );
}
