"use client";

import type { CommentSort } from "@/lib/comments";

interface Props {
  value: CommentSort;
  onChange: (v: CommentSort) => void;
}

const tabs: { value: CommentSort; label: string }[] = [
  { value: "top", label: "top" },
  { value: "new", label: "new" },
  { value: "hot", label: "🔥 hot" },
];

export function SortTabs({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            value === t.value
              ? "bg-dark text-white"
              : "text-text-secondary hover:bg-border-light"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
