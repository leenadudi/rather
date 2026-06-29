"use client";

import type { Choice } from "@/types";
import { useRouter } from "next/navigation";

interface Props {
  questionId: string;
  myChoice: Choice;
  oppositeCount: number;
  optionA: string;
  optionB: string;
  hasAccount: boolean;
}

export function DebateCTA({ questionId, myChoice, oppositeCount, optionA, optionB, hasAccount }: Props) {
  const router = useRouter();
  const oppositeOption = myChoice === "A" ? optionB : optionA;

  const handleDebate = async () => {
    // Debating needs an account — send visitors to sign in first.
    if (!hasAccount) {
      router.push("/signin");
      return;
    }
    router.push(`/debate/queue?question=${questionId}&side=${myChoice}`);
  };

  return (
    <button
      onClick={handleDebate}
      className="w-full text-left bg-dark rounded-2xl p-5 cursor-pointer transition-colors hover:bg-[#161616]"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-online inline-block shrink-0" />
        <span className="text-sm text-white font-medium leading-snug">
          debate someone who thinks {oppositeOption} is better
        </span>
      </div>
      <p className="text-xs text-text-muted">
        5-minute live debate · no winner declared
        {oppositeCount > 0 && ` · ${oppositeCount} waiting now`}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">
        {hasAccount ? "debate" : "sign in to debate"} <span aria-hidden>→</span>
      </span>
    </button>
  );
}
