// Profile colors. Avatars are a solid color (no initials). A user can pick one;
// otherwise we derive a stable color from their username so everyone still has a
// distinct, consistent dot.
export const AVATAR_COLORS = [
  "#378ADD", // blue
  "#7F77DD", // indigo
  "#4ADE80", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#8B5CF6", // violet
  "#64748B", // slate
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function isAvatarColor(value: string): value is AvatarColor {
  return (AVATAR_COLORS as readonly string[]).includes(value);
}

// Any #rrggbb color is allowed (picked from the gradient).
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

// hue (0–360) → hex, at the fixed saturation/lightness we use for avatars.
export function hueToHex(hue: number, s = 68, l = 55): string {
  const sat = s / 100, light = l / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// hex → hue (0–360), to position the slider from an existing color.
export function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return Math.round(h < 0 ? h + 360 : h);
}

// Deterministic pick from the palette based on the username.
export function colorFromSeed(seed: string): AvatarColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function resolveAvatarColor(color: string | null | undefined, seed: string): string {
  return color && isHexColor(color) ? color : colorFromSeed(seed || "?");
}
