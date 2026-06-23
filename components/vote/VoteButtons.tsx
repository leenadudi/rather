"use client";

import { useState } from "react";
import type { Choice } from "@/types";

interface Props {
  optionA: string;
  optionB: string;
  onVote: (choice: Choice) => void;
  disabled?: boolean;
  saving?: Choice | null;
}

export function VoteButtons({ optionA, optionB, onVote, disabled, saving }: Props) {
  const [hovered, setHovered] = useState<Choice | null>(null);

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={() => !disabled && onVote("A")}
        onMouseEnter={() => setHovered("A")}
        onMouseLeave={() => setHovered(null)}
        disabled={disabled}
        className={`
          relative w-full px-6 py-5 rounded-2xl border-2 text-left transition-all duration-150
          ${hovered === "A" || saving === "A"
            ? "border-side-a bg-side-a-bg"
            : "border-border bg-card hover:border-side-a hover:bg-side-a-bg"
          }
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        <span className="block text-xs font-semibold text-side-a uppercase tracking-wider mb-1">
          option a
        </span>
        <span className="text-lg font-semibold text-text-primary">{optionA}</span>
        {saving === "A" && (
          <span className="absolute top-3 right-3 text-xs text-side-a font-medium animate-pulse">
            saving…
          </span>
        )}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border-light" />
        <span className="text-xs text-text-muted font-medium">or</span>
        <div className="flex-1 h-px bg-border-light" />
      </div>

      <button
        onClick={() => !disabled && onVote("B")}
        onMouseEnter={() => setHovered("B")}
        onMouseLeave={() => setHovered(null)}
        disabled={disabled}
        className={`
          relative w-full px-6 py-5 rounded-2xl border-2 text-left transition-all duration-150
          ${hovered === "B" || saving === "B"
            ? "border-side-b bg-side-b-bg"
            : "border-border bg-card hover:border-side-b hover:bg-side-b-bg"
          }
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        <span className="block text-xs font-semibold text-side-b uppercase tracking-wider mb-1">
          option b
        </span>
        <span className="text-lg font-semibold text-text-primary">{optionB}</span>
        {saving === "B" && (
          <span className="absolute top-3 right-3 text-xs text-side-b font-medium animate-pulse">
            saving…
          </span>
        )}
      </button>
    </div>
  );
}
