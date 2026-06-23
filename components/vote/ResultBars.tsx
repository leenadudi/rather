"use client";

import { useEffect, useState } from "react";
import type { Choice, VoteCounts } from "@/types";

interface Props {
  optionA: string;
  optionB: string;
  counts: VoteCounts;
  myChoice: Choice;
}

export function ResultBars({ optionA, optionB, counts, myChoice }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  const pctA = Math.max(counts.pct_a, counts.total === 0 ? 50 : 4);
  const pctB = Math.max(counts.pct_b, counts.total === 0 ? 50 : 4);

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in">
      {/* Option A */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-side-a uppercase tracking-wider">option a</span>
            {myChoice === "A" && (
              <span className="text-xs bg-side-a text-white px-2 py-0.5 rounded-full font-medium">
                ✓ your pick
              </span>
            )}
          </div>
          <span className="text-sm font-bold text-side-a">{counts.pct_a}%</span>
        </div>
        <p className="text-sm text-text-primary font-medium mb-2">{optionA}</p>
        <div className="h-3 bg-side-a-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-side-a rounded-full bar-animated"
            style={{ width: animated ? `${pctA}%` : "0%" }}
          />
        </div>
        <p className="text-xs text-text-muted mt-1">{counts.a.toLocaleString()} votes</p>
      </div>

      {/* Option B */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-side-b uppercase tracking-wider">option b</span>
            {myChoice === "B" && (
              <span className="text-xs bg-side-b text-white px-2 py-0.5 rounded-full font-medium">
                ✓ your pick
              </span>
            )}
          </div>
          <span className="text-sm font-bold text-side-b">{counts.pct_b}%</span>
        </div>
        <p className="text-sm text-text-primary font-medium mb-2">{optionB}</p>
        <div className="h-3 bg-side-b-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-side-b rounded-full bar-animated"
            style={{ width: animated ? `${pctB}%` : "0%" }}
          />
        </div>
        <p className="text-xs text-text-muted mt-1">{counts.b.toLocaleString()} votes</p>
      </div>

      <p className="text-center text-xs text-text-muted mt-1">
        {counts.total.toLocaleString()} people have voted today
      </p>
    </div>
  );
}
