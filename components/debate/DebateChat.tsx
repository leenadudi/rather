"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { sendDebateMessage, endDebate, getDebateMessages } from "@/lib/debates";
import type { Choice, Debate, DebateMessage as TMessage } from "@/types";
import { DebateTimer } from "./DebateTimer";
import { DebateMessage } from "./DebateMessage";
import { DebateInput } from "./DebateInput";
import { PostDebateScreen } from "./PostDebateScreen";

const DEBATE_DURATION_MS = 5 * 60_000;
const SILENCE_WARNING_MS = 60_000;
const SILENCE_END_MS = 90_000;
const BOTH_SILENT_END_MS = 2 * 60_000;

interface Props {
  debate: Debate;
  mySide: Choice;
  optionA: string;
  optionB: string;
  isAnon: boolean;
}

export function DebateChat({ debate, mySide, optionA, optionB, isAnon }: Props) {
  const [messages, setMessages] = useState<TMessage[]>([]);
  const [ended, setEnded] = useState(debate.status === "ended" || debate.status === "flagged");
  const [opponentSilent60, setOpponentSilent60] = useState(false);
  const [opponentSilent90, setOpponentSilent90] = useState(false);
  const [flagWarning, setFlagWarning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastOpponentMsg = useRef<number>(Date.now());
  const lastAnyMsg = useRef<number>(Date.now());

  useEffect(() => {
    getDebateMessages(debate.id).then(setMessages);
  }, [debate.id]);

  // Realtime subscription
  useEffect(() => {
    if (ended) return;
    const channel = supabase
      .channel(`debate:${debate.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debate_messages", filter: `debate_id=eq.${debate.id}` },
        (payload) => {
          const msg = payload.new as TMessage;
          setMessages((prev) => [...prev, msg]);
          lastAnyMsg.current = Date.now();
          if (msg.sender_side !== mySide) {
            lastOpponentMsg.current = Date.now();
            setOpponentSilent60(false);
            setOpponentSilent90(false);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "debates", filter: `id=eq.${debate.id}` },
        (payload) => {
          const updated = payload.new as Debate;
          if (updated.status === "ended" || updated.status === "flagged") setEnded(true);
          if (updated.flag_count === 1) setFlagWarning(true);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [debate.id, mySide, ended]);

  // Silence detection
  useEffect(() => {
    if (ended) return;
    const id = setInterval(() => {
      const opponentSilence = Date.now() - lastOpponentMsg.current;
      const totalSilence = Date.now() - lastAnyMsg.current;
      setOpponentSilent60(opponentSilence > SILENCE_WARNING_MS);
      setOpponentSilent90(opponentSilence > SILENCE_END_MS);
      if (totalSilence > BOTH_SILENT_END_MS) {
        endDebate(debate.id).then(() => setEnded(true));
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [debate.id, ended]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (content: string) => {
    await sendDebateMessage(debate.id, mySide, content);
  }, [debate.id, mySide]);

  const handleEnd = useCallback(async () => {
    await endDebate(debate.id);
    setEnded(true);
  }, [debate.id]);

  const handleExpire = useCallback(() => {
    setEnded(true);
  }, []);

  if (ended) {
    const durationSec = debate.started_at
      ? Math.round((Date.now() - new Date(debate.started_at).getTime()) / 1000)
      : 0;
    return <PostDebateScreen messageCount={messages.length} durationSec={durationSec} isAnon={isAnon} />;
  }

  const theirOption = mySide === "A" ? optionB : optionA;
  const myOption = mySide === "A" ? optionA : optionB;

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light bg-card">
        <div className="text-xs text-text-secondary">
          <span className={`font-semibold ${mySide === "A" ? "text-side-a" : "text-side-b"}`}>you:</span>{" "}
          {myOption.substring(0, 40)}{myOption.length > 40 ? "…" : ""}
        </div>
        {debate.started_at && (
          <DebateTimer startedAt={debate.started_at} durationMs={DEBATE_DURATION_MS} onExpire={handleExpire} />
        )}
      </div>

      {/* Banners */}
      {flagWarning && (
        <div className="bg-warning-bg px-4 py-2 text-xs text-warning font-medium text-center">
          ⚠️ one more flag ends this debate — keep it about the question
        </div>
      )}
      {opponentSilent60 && !opponentSilent90 && (
        <div className="bg-warning-bg px-4 py-2 text-xs text-warning text-center">
          they haven&apos;t responded in 60 seconds
        </div>
      )}
      {opponentSilent90 && (
        <div className="bg-error-bg px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-error">no response for 90 seconds</span>
          <button onClick={handleEnd} className="text-xs font-semibold text-error underline">
            end debate early
          </button>
        </div>
      )}

      {/* Context banner */}
      <div className="px-4 py-2 bg-background border-b border-border-light text-xs text-text-muted text-center">
        them: {theirOption.substring(0, 50)}{theirOption.length > 50 ? "…" : ""}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-text-muted py-8">
            start the debate — make your case
          </p>
        )}
        {messages.map((m) => (
          <DebateMessage key={m.id} message={m} mySide={mySide} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-light bg-card">
        <DebateInput onSend={handleSend} />
      </div>
    </div>
  );
}
