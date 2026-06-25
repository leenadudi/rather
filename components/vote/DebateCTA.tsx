"use client";

import type { Choice } from "@/types";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Props {
  questionId: string;
  myChoice: Choice;
  oppositeCount: number;
}

export function DebateCTA({ questionId, myChoice, oppositeCount }: Props) {
  const router = useRouter();
  const opposite: Choice = myChoice === "A" ? "B" : "A";
  const label = opposite === "A" ? "a" : "b";

  const handleDebate = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user || data.user.is_anonymous) {
      router.push("/signin");
      return;
    }
    router.push(`/debate/queue?question=${questionId}&side=${myChoice}`);
  };

  return (
    <div className="w-full bg-dark rounded-2xl p-5 flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-online inline-block" />
          <span className="text-sm text-white font-medium">
            {oppositeCount > 0
              ? `${oppositeCount} people on option ${label} waiting`
              : `find someone on option ${label} to debate`}
          </span>
        </div>
        <p className="text-xs text-text-muted">5-minute live debate · no winner declared</p>
      </div>
      <button
        onClick={handleDebate}
        className="shrink-0 bg-white text-dark text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        debate →
      </button>
    </div>
  );
}
