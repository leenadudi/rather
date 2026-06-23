"use client";

import type { DebateMessage as TDebateMessage, Choice } from "@/types";

interface Props {
  message: TDebateMessage;
  mySide: Choice;
}

export function DebateMessage({ message, mySide }: Props) {
  const isMe = message.sender_side === mySide;

  if (message.flagged) {
    return (
      <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-3`}>
        <div className="max-w-xs px-4 py-3 rounded-2xl bg-warning-bg border border-yellow-200">
          <p className="text-xs text-warning">🚩 this message was auto-flagged and hidden</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-xs px-4 py-3 text-sm text-text-primary ${
          message.sender_side === "A" ? "bubble-a" : "bubble-b"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
