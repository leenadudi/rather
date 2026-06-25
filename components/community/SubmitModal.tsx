"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitCommunityQuestion } from "@/lib/server/community";
import { useAccountGate } from "@/components/auth/useRequireAccount";

interface Props {
  onClose: () => void;
}

export function SubmitModal({ onClose }: Props) {
  const router = useRouter();
  const gate = useAccountGate();
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = optionA.trim();
    const b = optionB.trim();
    if (a.length < 2 || b.length < 2) { setError("both options need a few more characters"); return; }
    if (a.toLowerCase() === b.toLowerCase()) { setError("the two options should be different"); return; }

    setLoading(true);
    setError("");
    const res = gate(await submitCommunityQuestion(a, b));
    if (!res.ok) {
      setError(res.error ?? "couldn't post — try again");
      setLoading(false);
      return;
    }
    router.push(`/explore/${res.data.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-lg p-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-text-primary">submit a would you rather</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors -mt-1 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          post it to the community — people vote and you watch the split happen.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-side-a block mb-1.5">would you rather…</label>
            <textarea
              value={optionA}
              onChange={(e) => { setOptionA(e.target.value); setError(""); }}
              placeholder="have a photographic memory"
              rows={2}
              maxLength={140}
              autoFocus
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-side-a transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-xs text-text-muted">or</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>

          <div>
            <label className="text-xs font-semibold text-side-b block mb-1.5">…or</label>
            <textarea
              value={optionB}
              onChange={(e) => { setOptionB(e.target.value); setError(""); }}
              placeholder="forget everything after 24 hours"
              rows={2}
              maxLength={140}
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-side-b transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border text-text-secondary text-sm font-semibold rounded-xl hover:border-text-secondary transition-colors"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-dark text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-text-secondary transition-colors"
            >
              {loading ? "posting…" : "post question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
