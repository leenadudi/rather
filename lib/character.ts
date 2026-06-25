import { supabase } from "./supabase";
import type { CharacterCard, QuestionDimension } from "@/types";

const DIMENSION_LABELS: Record<QuestionDimension, [string, string]> = {
  honesty_vs_tact: ["honesty", "tact"],
  autonomy_vs_belonging: ["autonomy", "belonging"],
  experience_vs_security: ["experience", "security"],
  clarity_vs_kindness: ["clarity", "kindness"],
  individual_vs_social: ["individual", "social"],
  present_vs_future: ["present", "future"],
};

export async function buildCharacterCard(
  userId: string,
  year: number,
  month: number
): Promise<CharacterCard | null> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const { data: votes } = await supabase
    .from("votes")
    .select("choice, question_id")
    .eq("user_id", userId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (!votes?.length || votes.length < 7) return null;

  const qIds = votes.map((v) => v.question_id);
  const { data: questions } = await supabase
    .from("questions")
    .select("id, dimension")
    .in("id", qIds);

  const dimMap = new Map(questions?.map((q) => [q.id, q.dimension as QuestionDimension]) ?? []);

  // Aggregate per dimension
  const dimData: Record<string, { a: number; b: number }> = {};
  for (const v of votes) {
    const dim = dimMap.get(v.question_id);
    if (!dim) continue;
    if (!dimData[dim]) dimData[dim] = { a: 0, b: 0 };
    if (v.choice === "A") dimData[dim].a++;
    else dimData[dim].b++;
  }

  // Compute signal strength (distance from 50%)
  const dims = Object.entries(dimData)
    .map(([dim, { a, b }]) => {
      const total = a + b;
      const pct = total === 0 ? 50 : Math.round((a / total) * 100);
      const signal = Math.abs(pct - 50);
      const [la, lb] = DIMENSION_LABELS[dim as QuestionDimension];
      return { name: dim as QuestionDimension, pct, signal, label_a: la, label_b: lb };
    })
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 3);

  if (!dims.length) return null;

  const top = dims[0];
  const leanLabel = top.pct > 50 ? top.label_a : top.label_b;
  const otherLabel = top.pct > 50 ? top.label_b : top.label_a;
  const headline = `someone who chooses ${leanLabel} over ${otherLabel}`;

  // Find contradiction: a dimension where they usually lean one way but reversed 3+ times
  let tension = "";
  for (const d of dims) {
    const { a, b } = dimData[d.name];
    const total = a + b;
    if (total >= 4) {
      const minor = Math.min(a, b);
      const [la, lb] = DIMENSION_LABELS[d.name];
      const minorLabel = a > b ? lb : la;
      if (minor >= 3) {
        tension = `but when stakes got personal, you chose ${minorLabel} ${minor} of ${total} times — make of that what you will`;
        break;
      }
    }
  }

  const { count: debateCount } = await supabase
    .from("debates")
    .select("*", { count: "exact", head: true })
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq("status", "ended");

  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];

  return {
    period: `${monthNames[month - 1]} ${year}`,
    headline,
    tension,
    dimensions: dims,
    stats: {
      questions: votes.length,
      debates: debateCount ?? 0,
      mind_changes: 0, // vote-change tracking not yet implemented; always 0 until wired up
    },
  };
}
