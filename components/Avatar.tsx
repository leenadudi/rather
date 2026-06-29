import { resolveAvatarColor } from "@/lib/avatar";

interface Props {
  // username (or any stable seed) used to derive a fallback color
  seed: string;
  // the user's chosen color, if any
  color?: string | null;
  // pixel size of the circle
  size?: number;
  className?: string;
}

// A solid-color avatar — no initials. Color is the user's chosen one, else
// derived from the seed so it stays stable and distinct.
export function Avatar({ seed, color, size = 32, className = "" }: Props) {
  const bg = resolveAvatarColor(color, seed);
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: bg }}
      aria-hidden
    />
  );
}
