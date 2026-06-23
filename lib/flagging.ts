const BLOCKLIST = [
  "idiot", "stupid", "moron", "loser", "kill yourself", "kys",
  "retard", "faggot", "nigger", "bitch", "asshole",
];

export function containsBlockedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((word) => lower.includes(word));
}
