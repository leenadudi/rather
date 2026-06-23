"use client";

import type { CharacterCard as TCard } from "@/types";

interface Props {
  card: TCard;
  onShare?: () => void;
}

export function CharacterCard({ card, onShare }: Props) {
  return (
    <div className="bg-dark rounded-3xl p-6 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">
        {card.period}
      </p>

      <h2 className="text-xl font-bold leading-snug mb-3">{card.headline}</h2>

      {card.tension && (
        <p className="text-sm text-white/60 leading-relaxed mb-6">{card.tension}</p>
      )}

      {/* Dimension bars */}
      <div className="space-y-4 mb-6">
        {card.dimensions.map((d) => (
          <div key={d.name}>
            <div className="flex justify-between text-xs text-white/60 mb-1.5">
              <span>{d.label_a}</span>
              <span>{d.label_b}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-700"
                style={{ width: `${d.pct}%` }}
              />
            </div>
            <p className="text-right text-xs text-white/40 mt-1">{d.pct}% {d.label_a}</p>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex gap-6 border-t border-white/10 pt-4 mb-5">
        <div className="text-center">
          <p className="text-lg font-bold">{card.stats.questions}</p>
          <p className="text-xs text-white/50">questions</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{card.stats.debates}</p>
          <p className="text-xs text-white/50">debates</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{card.stats.mind_changes}</p>
          <p className="text-xs text-white/50">mind changes</p>
        </div>
      </div>

      {onShare && (
        <button
          onClick={onShare}
          className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          tap to share your character →
        </button>
      )}
    </div>
  );
}
