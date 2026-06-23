"use client";

import Link from "next/link";

interface Props {
  voteCount: number;
  required?: number;
  sneak?: string;
}

export function CharacterProgress({ voteCount, required = 7, sneak }: Props) {
  const dots = Array.from({ length: required }, (_, i) => i < voteCount);

  return (
    <div className="bg-dark rounded-3xl p-6 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">
        your character
      </p>
      <h2 className="text-xl font-bold mb-2">still forming…</h2>
      <p className="text-sm text-white/60 mb-5">
        {voteCount} of {required} votes needed this month
      </p>

      <div className="flex gap-2 mb-5">
        {dots.map((filled, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${filled ? "bg-white" : "bg-white/20"}`}
          />
        ))}
      </div>

      {sneak && (
        <p className="text-xs text-white/50 mb-5 italic">
          leaning: {sneak} (based on limited data)
        </p>
      )}

      <Link
        href="/"
        className="block w-full text-center py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        vote today&apos;s question →
      </Link>
    </div>
  );
}
