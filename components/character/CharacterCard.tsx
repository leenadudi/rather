"use client";

import type { CharacterCard as TCard, QuestionDimension } from "@/types";

const DIMENSION_COLORS: Record<QuestionDimension, string> = {
  honesty_vs_tact: "#378ADD",
  clarity_vs_kindness: "#378ADD",
  autonomy_vs_belonging: "#7F77DD",
  individual_vs_social: "#7F77DD",
  experience_vs_security: "#4ADE80",
  present_vs_future: "#F59E0B",
};

interface Props {
  card: TCard;
  onShare?: () => void;
}

export function CharacterCard({ card, onShare }: Props) {
  return (
    <div className="bg-dark rounded-3xl p-7 text-white">
      {/* Breadcrumb */}
      <p className="text-xs text-white/40 mb-5">
        would you rather · {card.period} · your character
      </p>

      <p className="text-sm text-white/50 mb-2">this month you showed up as</p>
      <h2 className="text-3xl font-bold leading-tight mb-3">{card.headline}</h2>

      {card.tension && (
        <p className="text-sm text-white/50 leading-relaxed mb-7">{card.tension}</p>
      )}

      {/* Dimension bars */}
      {card.dimensions.length > 0 && (
        <div className="space-y-5 mb-7">
          {card.dimensions.map((d) => {
            const color = DIMENSION_COLORS[d.name] ?? "#ffffff";
            const leansA = d.pct >= 50;
            return (
              <div key={d.name}>
                <div className="flex justify-between text-xs mb-2">
                  <span className={leansA ? "font-bold text-white" : "text-white/40"}>
                    {d.label_a}
                  </span>
                  <span className={!leansA ? "font-bold text-white" : "text-white/40"}>
                    {d.label_b}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.pct}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color }}>
                  {d.pct}%
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-6 border-t border-white/10 pt-5 mb-5">
        <div>
          <p className="text-2xl font-bold">{card.stats.questions}</p>
          <p className="text-xs text-white/40 mt-0.5">questions this month</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{card.stats.debates}</p>
          <p className="text-xs text-white/40 mt-0.5">debates</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{card.stats.mind_changes}×</p>
          <p className="text-xs text-white/40 mt-0.5">changed your mind</p>
        </div>
      </div>

      {/* Share button */}
      <div className="flex justify-end">
        {onShare ? (
          <button
            onClick={onShare}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            share this card →
          </button>
        ) : (
          <button className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors">
            share this card →
          </button>
        )}
      </div>
    </div>
  );
}
