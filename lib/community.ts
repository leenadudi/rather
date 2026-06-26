import { supabase } from "./supabase";
import type {
  Choice,
  CommunityQuestion,
  CommunitySort,
  CommunityStats,
  Question,
  VoteCounts,
} from "@/types";

function toCounts(a: number, b: number): VoteCounts {
  const total = a + b;
  return {
    a,
    b,
    total,
    pct_a: total === 0 ? 50 : Math.round((a / total) * 100),
    pct_b: total === 0 ? 50 : Math.round((b / total) * 100),
  };
}

// Fetches the community feed with vote counts, comment counts, and the current
// user's own vote — all via a few batched queries rather than per-question.
export async function getCommunityFeed(
  sort: CommunitySort,
  userId: string | null,
  limit = 50
): Promise<CommunityQuestion[]> {
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("type", "community")
    .neq("status", "hidden")
    .order("created_at", { ascending: false })
    .limit(limit);

  const qs = (questions ?? []) as Question[];
  if (qs.length === 0) return [];

  const ids = qs.map((q) => q.id);

  // Batch: all votes for these questions (+ created_at for trending window).
  const [{ data: votes }, { data: comments }, authorRows, myVotes] = await Promise.all([
    supabase.from("votes").select("question_id, choice, created_at").in("question_id", ids),
    supabase.from("comments").select("question_id").in("question_id", ids),
    supabase
      .from("users")
      .select("id, username")
      .in("id", qs.map((q) => q.author_id).filter(Boolean) as string[]),
    userId
      ? supabase.from("votes").select("question_id, choice").eq("user_id", userId).in("question_id", ids)
      : Promise.resolve({ data: [] as { question_id: string; choice: string }[] }),
  ]);

  const dayAgo = Date.now() - 86_400_000;
  const countMap = new Map<string, { a: number; b: number }>();
  const recentMap = new Map<string, number>(); // votes in last 24h, for trending
  for (const id of ids) { countMap.set(id, { a: 0, b: 0 }); recentMap.set(id, 0); }
  for (const v of votes ?? []) {
    const c = countMap.get(v.question_id);
    if (!c) continue;
    if (v.choice === "A") c.a++; else c.b++;
    if (new Date(v.created_at).getTime() >= dayAgo) {
      recentMap.set(v.question_id, (recentMap.get(v.question_id) ?? 0) + 1);
    }
  }

  const commentMap = new Map<string, number>();
  for (const c of comments ?? []) commentMap.set(c.question_id, (commentMap.get(c.question_id) ?? 0) + 1);

  const authorMap = new Map<string, string>();
  for (const u of authorRows.data ?? []) authorMap.set(u.id, u.username);

  const myMap = new Map<string, Choice>();
  for (const v of myVotes.data ?? []) myMap.set(v.question_id, v.choice as Choice);

  const enriched: CommunityQuestion[] = qs.map((q) => {
    const c = countMap.get(q.id)!;
    return {
      ...q,
      counts: toCounts(c.a, c.b),
      comment_count: commentMap.get(q.id) ?? 0,
      my_choice: myMap.get(q.id) ?? null,
      author_username: q.author_id ? authorMap.get(q.author_id) ?? null : null,
    };
  });

  if (sort === "new") {
    return enriched; // already created_at desc
  }
  if (sort === "top") {
    return enriched.sort((x, y) => y.counts.total - x.counts.total);
  }
  // trending: most votes in the last 24h, then total as a tiebreak
  return enriched.sort((x, y) => {
    const rx = recentMap.get(x.id) ?? 0;
    const ry = recentMap.get(y.id) ?? 0;
    if (ry !== rx) return ry - rx;
    return y.counts.total - x.counts.total;
  });
}

export async function getCommunityQuestion(
  id: string,
  userId: string | null
): Promise<CommunityQuestion | null> {
  const { data: q } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .eq("type", "community")
    .neq("status", "hidden")
    .single();
  if (!q) return null;

  const [{ data: votes }, { count: commentCount }, author, myVote] = await Promise.all([
    supabase.from("votes").select("choice").eq("question_id", id),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("question_id", id),
    q.author_id
      ? supabase.from("users").select("username").eq("id", q.author_id).single()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("votes").select("choice").eq("question_id", id).eq("user_id", userId).limit(1).single()
      : Promise.resolve({ data: null }),
  ]);

  let a = 0, b = 0;
  for (const v of votes ?? []) { if (v.choice === "A") a++; else b++; }

  return {
    ...(q as Question),
    counts: toCounts(a, b),
    comment_count: commentCount ?? 0,
    my_choice: (myVote.data?.choice as Choice) ?? null,
    author_username: (author.data as { username: string } | null)?.username ?? null,
  };
}

export async function getReportedQuestions(): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("type", "community")
    .eq("status", "hidden")
    .order("created_at", { ascending: false });
  return (data ?? []) as Question[];
}

export async function getCommunityStats(userId: string): Promise<CommunityStats> {
  const { data: mine } = await supabase
    .from("questions")
    .select("id")
    .eq("type", "community")
    .eq("author_id", userId);

  const ids = (mine ?? []).map((q) => q.id);
  if (ids.length === 0) return { submitted: 0, live: 0, total_votes: 0 };

  const { count: voteCount } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .in("question_id", ids);

  return {
    submitted: ids.length,
    live: ids.length, // every submitted community question is live
    total_votes: voteCount ?? 0,
  };
}
