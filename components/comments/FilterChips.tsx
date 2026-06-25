"use client";

import type { CommentFilter } from "@/lib/comments";

interface Props {
  value: CommentFilter;
  onChange: (v: CommentFilter) => void;
  optionA?: string;
  optionB?: string;
}

function short(text: string, max = 18) {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}

export function FilterChips({ value, onChange, optionA, optionB }: Props) {
  const chips: { value: CommentFilter; label: string }[] = [
    { value: "all", label: "all" },
    { value: "A", label: optionA ? short(optionA) : "option a" },
    { value: "B", label: optionB ? short(optionB) : "option b" },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {chips.map((c) => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            value === c.value
              ? c.value === "A"
                ? "bg-side-a-bg border-side-a text-side-a-dark"
                : c.value === "B"
                ? "bg-side-b-bg border-side-b text-side-b-dark"
                : "bg-dark border-dark text-white"
              : "border-border text-text-secondary hover:border-text-secondary"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
