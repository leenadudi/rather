"use client";

import { useEffect, useState } from "react";

interface Props {
  startedAt: string;
  durationMs?: number;
  onExpire: () => void;
}

export function DebateTimer({ startedAt, durationMs = 5 * 60_000, onExpire }: Props) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
      if (left === 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAt, durationMs, onExpire]);

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isRed = remaining <= 60_000;

  return (
    <span className={`font-mono font-bold text-lg tabular-nums ${isRed ? "text-error" : "text-text-primary"}`}>
      {label}
    </span>
  );
}
