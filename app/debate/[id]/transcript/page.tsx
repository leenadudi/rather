"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getDebateMessages } from "@/lib/debates";
import type { Debate, DebateMessage, Question } from "@/types";

export default function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [mySide, setMySide] = useState<"A" | "B" | null>(null);
  const [isParticipant, setIsParticipant] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      const { data: d } = await supabase.from("debates").select("*").eq("id", id).single();
      if (!d) { setIsParticipant(false); return; }
      setDebate(d as Debate);

      const participant = !!uid && (d.user_a_id === uid || d.user_b_id === uid);
      setIsParticipant(participant);
      if (!participant) return;  // transcripts are private to the two debaters

      if (d.user_a_id === uid) setMySide("A");
      else if (d.user_b_id === uid) setMySide("B");

      const msgs = await getDebateMessages(id);
      setMessages(msgs);

      const { data: q } = await supabase.from("questions").select("*").eq("id", d.question_id).single();
      setQuestion(q as Question);
    }
    load();
  }, [id]);

  if (isParticipant === false) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-text-secondary text-lg font-medium">this transcript is private</p>
          <p className="text-text-muted text-sm mt-2">only the two people who debated can read it.</p>
          <Link href="/" className="inline-block mt-5 text-sm text-text-muted hover:text-text-primary underline">
            back to today&apos;s question
          </Link>
        </div>
      </main>
    );
  }

  if (!debate || !question) {
    return <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-muted text-sm">loading…</p>
    </main>;
  }

  return (
    <main className="min-h-screen bg-background max-w-md mx-auto px-4 py-8">
      <Link href="/history" className="text-xs text-text-muted hover:text-text-secondary underline mb-6 block">
        ← back to history
      </Link>

      <h1 className="text-xl font-bold text-text-primary mb-1">debate transcript</h1>
      <p className="text-sm text-text-secondary mb-2">
        {question.option_a} or {question.option_b}
      </p>
      {mySide && (
        <p className="text-xs text-text-muted mb-6">
          you were on option {mySide.toLowerCase()}
        </p>
      )}

      <div className="space-y-3">
        {messages.map((m) => {
          const isMe = mySide ? m.sender_side === mySide : m.sender_side === "A";
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs px-4 py-3 rounded-2xl text-sm ${
                m.sender_side === "A" ? "bg-side-a-bg text-text-primary" : "bg-side-b-bg text-text-primary"
              }`}>
                {m.flagged ? (
                  <p className="text-xs text-warning">🚩 flagged and hidden</p>
                ) : (
                  m.content
                )}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">no messages in this debate</p>
        )}
      </div>
    </main>
  );
}
