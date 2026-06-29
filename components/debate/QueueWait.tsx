"use client";

import { useEffect, useState } from "react";
import type { Choice } from "@/types";

interface Props {
  side: Choice;
  questionId: string;
  queueCounts: { a: number; b: number };
  onCancel: () => void;
  optionA?: string;
  optionB?: string;
}

function short(text: string, max = 30) {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}

export function QueueWait({ side, queueCounts, onCancel, optionA, optionB }: Props) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 500);
    return () => clearInterval(id);
  }, []);

  const opposite: Choice = side === "A" ? "B" : "A";
  const myCount = side === "A" ? queueCounts.a : queueCounts.b;
  const theirCount = side === "A" ? queueCounts.b : queueCounts.a;
  const asymmetric = myCount > theirCount * 3;

  const myLabel = side === "A" ? (optionA ? short(optionA) : "option a") : (optionB ? short(optionB) : "option b");
  const oppLabel = opposite === "A" ? (optionA ? short(optionA) : "option a") : (optionB ? short(optionB) : "option b");

  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-dark flex items-center justify-center mb-6">
        <span className={`text-xs font-bold text-white ${myLabel.length > 10 ? "text-[10px]" : "text-sm"} px-1 text-center leading-tight`}>
          {myLabel}
        </span>
      </div>

      <h2 className="text-xl font-bold text-text-primary mb-2">
        finding an opponent{dots}
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        looking for someone who thinks {oppLabel} to debate you
      </p>

      {asymmetric && (
        <div className="bg-warning-bg border border-yellow-200 rounded-xl px-4 py-3 mb-4 max-w-xs">
          <p className="text-xs text-warning">
            more people chose &ldquo;{myLabel}&rdquo; today — estimated wait may be longer
          </p>
          <p className="text-xs text-warning mt-1">
            {myCount} waiting on your side · {theirCount} on theirs
          </p>
        </div>
      )}

      <button
        onClick={onCancel}
        className="text-sm text-text-muted hover:text-text-secondary underline transition-colors"
      >
        cancel
      </button>
    </div>
  );
}
