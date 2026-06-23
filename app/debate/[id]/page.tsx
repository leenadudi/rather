"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: d } = await supabase.from("debates").select("*").eq("id", id).single();
      if (!d) { setLoading(false); return; }
      setDebate(d as Debate);
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

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <DebateChat
        debate={debate}
        mySide={side}
        optionA={question.option_a}
        optionB={question.option_b}
        isAnon={true}
      />
    </main>
  );
}
