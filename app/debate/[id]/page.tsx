"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Choice, Debate, Question } from "@/types";
import { DebateChat } from "@/components/debate/DebateChat";

export default function DebatePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const side = (params.get("side") ?? "A") as Choice;

  const [debate, setDebate] = useState<Debate | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: d } = await supabase.from("debates").select("*").eq("id", id).single();
      if (!d) { setLoading(false); return; }
      setDebate(d as Debate);
      setIsParticipant(!!user && (d.user_a_id === user.id || d.user_b_id === user.id));
      const { data: q } = await supabase.from("questions").select("*").eq("id", d.question_id).single();
      setQuestion(q as Question);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">loading debate…</p>
      </main>
    );
  }

  if (!debate || !question) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted text-sm">debate not found</p>
      </main>
    );
  }

  // Live debates are private to the two participants.
  if (!isParticipant) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-text-secondary text-lg font-medium">this debate is private</p>
          <p className="text-text-muted text-sm mt-2">only the two people debating can see it.</p>
          <Link href="/" className="inline-block mt-5 text-sm text-text-muted hover:text-text-primary underline">
            back to today&apos;s question
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <DebateChat
        debate={debate}
        mySide={side}
        optionA={question.option_a}
        optionB={question.option_b}
        isAnon={false}
      />
    </main>
  );
}
