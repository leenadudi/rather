"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getQueueCounts } from "@/lib/debates";
import { joinDebateQueue, cancelQueue, heartbeatQueue } from "@/lib/server/debates";
import { useAccountGate } from "@/components/auth/useRequireAccount";
import { QueueWait } from "@/components/debate/QueueWait";
import type { Choice, Debate } from "@/types";

function QueueContent() {
  const router = useRouter();
  const gate = useAccountGate();
  const params = useSearchParams();
  const questionId = params.get("question") ?? "";
  const side = (params.get("side") ?? "A") as Choice;

  const matchedRef = useRef(false);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [queueCounts, setQueueCounts] = useState({ a: 0, b: 0 });
  const [joining, setJoining] = useState(false);
  const [optionA, setOptionA] = useState<string | undefined>();
  const [optionB, setOptionB] = useState<string | undefined>();

  useEffect(() => {
    if (!questionId) return;
    getQueueCounts(questionId).then(setQueueCounts);

    supabase
      .from("questions")
      .select("option_a, option_b")
      .eq("id", questionId)
      .single()
      .then(({ data }) => {
        if (data) { setOptionA(data.option_a); setOptionB(data.option_b); }
      });

    setJoining(true);
    joinDebateQueue(questionId, side).then((res) => {
      const gated = gate(res);
      if (!gated.ok) { setJoining(false); if (gated.code !== "account_required") router.back(); return; }
      const { debateId, matched } = gated.data;
      setDebate({ id: debateId, status: "waiting" } as Debate);
      setJoining(false);
      if (matched) {
        matchedRef.current = true;
        router.replace(`/debate/${debateId}?side=${side}`);
      }
    });
  }, [questionId, side, router]);

  useEffect(() => {
    if (!debate || debate.status !== "waiting") return;
    const channel = supabase
      .channel(`debate-match:${debate.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "debates", filter: `id=eq.${debate.id}` },
        (payload) => {
          const updated = payload.new as Debate;
          if (updated.status === "active") {
            matchedRef.current = true;
            router.replace(`/debate/${debate.id}?side=${side}`);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [debate, side, router]);

  useEffect(() => {
    if (!debate || debate.status !== "waiting") return;

    const ping = () => { heartbeatQueue(debate.id); };
    ping(); // immediate, so a slow first interval doesn't let us look stale
    const interval = setInterval(ping, 10_000);

    // Best-effort cancel if the user backgrounds or closes the tab while waiting.
    const onHidden = () => {
      if (document.visibilityState === "hidden" && !matchedRef.current) {
        cancelQueue(debate.id);
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
      // Unmount while still waiting and not matched => leaving the queue.
      if (!matchedRef.current) cancelQueue(debate.id);
    };
  }, [debate]);

  const handleCancel = async () => {
    if (debate) {
      await cancelQueue(debate.id);
    }
    router.back();
  };

  if (joining) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">joining queue…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background max-w-md mx-auto px-4">
      <QueueWait
        side={side}
        questionId={questionId}
        queueCounts={queueCounts}
        onCancel={handleCancel}
        optionA={optionA}
        optionB={optionB}
      />
    </main>
  );
}

export default function DebateQueuePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading…</p>
      </main>
    }>
      <QueueContent />
    </Suspense>
  );
}
