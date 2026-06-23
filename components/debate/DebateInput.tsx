"use client";

import { useState } from "react";
import { containsBlockedContent } from "@/lib/flagging";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function DebateInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [flagError, setFlagError] = useState(false);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (containsBlockedContent(trimmed)) {
      setFlagError(true);
      return;
    }
    setFlagError(false);
    onSend(trimmed);
    setText("");
  };

  return (
    <div>
      {flagError && (
        <p className="text-xs text-warning mb-2 px-1">
          keep it about the question, not the person
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setFlagError(false); }}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          disabled={disabled}
          placeholder={disabled ? "waiting…" : "type your argument…"}
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary disabled:opacity-50 transition-colors"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="px-4 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-text-secondary transition-colors"
        >
          send
        </button>
      </div>
    </div>
  );
}
