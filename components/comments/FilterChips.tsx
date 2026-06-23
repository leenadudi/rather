"use client";

import type { CommentFilter } from "@/lib/comments";

interface Props {
  value: CommentFilter;
  onChange: (v: CommentFilter) => void;
}

const chips: { value: CommentFilter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "A", label: "team a" },
  { value: "B", label: "team b" },
];

export function FilterChips({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
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
