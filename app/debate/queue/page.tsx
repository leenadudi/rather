"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { joinDebateQueue, getQueueCounts } from "@/lib/debates";
import { getDeviceId } from "@/lib/fingerprint";
import { QueueWait } from "@/components/debate/QueueWait";
import type { Choice, Debate } from "@/types";

function QueueContent() {
  const router = useRouter();
  const params = useSearchParams();
  const questionId = params.get("question") ?? "";
  const side = (params.get("side") ?? "A") as Choice;

  const [debate, setDebate] = useState<Debate | null>(null);
  const [queueCounts, setQueueCounts] = useState({ a: 0, b: 0 });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!questionId) return;
    getQueueCounts(questionId).then(setQueueCounts);

    setJoining(true);
    const deviceId = getDeviceId();
    joinDebateQueue(questionId, side, deviceId).then(({ debate: d, matched }) => {
      setDebate(d);
      setJoining(false);
      if (matched) {
        router.replace(`/debate/${d.id}?side=${side}`);
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
            router.replace(`/debate/${debate.id}?side=${side}`);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [debate, side, router]);

  const handleCancel = async () => {
    if (debate) {
      await supabase.from("debates").delete().eq("id", debate.id);
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
