export function generateRecoveryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `WYR-${segment()}-${segment()}-${segment()}`;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
