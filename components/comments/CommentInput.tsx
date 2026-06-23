"use client";

import { useState } from "react";

interface Props {
  onPost: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentInput({ onPost, placeholder = "add a comment…", autoFocus }: Props) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    await onPost(trimmed);
    setText("");
    setPosting(false);
  };

  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors"
      />
      <button
        onClick={submit}
        disabled={!text.trim() || posting}
        className="px-4 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-text-secondary transition-colors"
      >
        {posting ? "…" : "post"}
      </button>
    </div>
  );
}
