"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  messageCount: number;
  durationSec: number;
  isAnon: boolean;
}

export function PostDebateScreen({ messageCount, durationSec, isAnon }: Props) {
  const [reflection, setReflection] = useState<"yes" | "no" | null>(null);
  const [note, setNote] = useState("");
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;

  return (
    <div className="flex flex-col items-center py-12 text-center max-w-sm mx-auto">
      <p className="text-xs text-text-muted uppercase tracking-widest mb-2">debate ended</p>
      <h2 className="text-2xl font-bold text-text-primary mb-1">that&apos;s a wrap</h2>
      <p className="text-sm text-text-secondary mb-8">
        {messageCount} messages · {mins}m {secs}s
      </p>

      {/* Reflection prompt */}
      <div className="w-full bg-card border border-border-light rounded-2xl p-5 mb-6 text-left">
        <p className="text-sm font-semibold text-text-primary mb-4">
          did anything they said make you think differently?
        </p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setReflection("yes")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              reflection === "yes"
                ? "bg-dark text-white border-dark"
                : "border-border text-text-secondary hover:border-text-secondary"
            }`}
          >
            yes
          </button>
          <button
            onClick={() => setReflection("no")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              reflection === "no"
                ? "bg-dark text-white border-dark"
                : "border-border text-text-secondary hover:border-text-secondary"
            }`}
          >
            not really
          </button>
        </div>
        {reflection === "yes" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="what changed? (optional)"
            rows={2}
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
          />
        )}
      </div>

      {isAnon && (
        <div className="w-full bg-card border border-border-light rounded-2xl p-5 mb-4 text-left">
          <p className="text-sm font-semibold text-text-primary mb-1">save this to your history</p>
          <p className="text-xs text-text-secondary mb-3">
            create a free account to keep your debate history, character card, and more
          </p>
          <Link
            href="/signin"
            className="block w-full text-center bg-dark text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-text-secondary transition-colors"
          >
            create free account
          </Link>
          <Link
            href="/signin"
            className="block w-full text-center text-text-muted text-xs mt-2 hover:text-text-secondary"
          >
            already have one? sign in
          </Link>
        </div>
      )}

      <Link
        href="/"
        className="text-sm text-text-muted hover:text-text-secondary underline"
      >
        back to today&apos;s question
      </Link>
    </div>
  );
}
