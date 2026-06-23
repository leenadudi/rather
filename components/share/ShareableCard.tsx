"use client";

import type { Choice, Question } from "@/types";

interface Props {
  question: Question;
  myChoice: Choice;
  dateStr: string;
}

export function ShareableCard({ question, myChoice, dateStr }: Props) {
  const chosenOption = myChoice === "A" ? question.option_a : question.option_b;

  return (
    <div className="w-[390px] h-[390px] bg-dark rounded-3xl p-8 flex flex-col justify-between text-white mx-auto">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">
          would you rather · {dateStr}
        </p>
        <p className="text-lg font-bold leading-snug mb-4">
          {question.option_a}
          <span className="text-white/40 font-normal"> or </span>
          {question.option_b}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-white/70 mb-1">i chose</p>
        <p className="text-xl font-bold">{chosenOption}</p>
      </div>

      <div className="bg-white/10 rounded-xl px-4 py-3">
        <p className="text-xs text-white/60">🔒 results hidden until you vote</p>
        <p className="text-xs text-white/40 mt-0.5">tap to vote & predict what i chose →</p>
      </div>
    </div>
  );
}
