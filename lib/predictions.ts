import { supabase } from "./supabase";
import type { Choice, Prediction } from "@/types";

export async function makePrediction(
  predictorId: string,
  targetId: string,
  questionId: string,
  predictedChoice: Choice
): Promise<boolean> {
  const { error } = await supabase.from("predictions").insert({
    predictor_id: predictorId,
    target_id: targetId,
    question_id: questionId,
    predicted_choice: predictedChoice,
  });
  return !error;
}

export async function getPredictions(
  predictorId: string,
  questionId: string
): Promise<Prediction[]> {
  const { data } = await supabase
    .from("predictions")
    .select("*")
    .eq("predictor_id", predictorId)
    .eq("question_id", questionId);
  return (data ?? []) as Prediction[];
}

export async function getFriendshipAccuracy(
  predictorId: string,
  targetId: string
): Promise<{ correct: number; total: number }> {
  const { data: preds } = await supabase
    .from("predictions")
    .select("predicted_choice, question_id")
    .eq("predictor_id", predictorId)
    .eq("target_id", targetId);

  if (!preds?.length) return { correct: 0, total: 0 };

  const qIds = preds.map((p) => p.question_id);
  const { data: votes } = await supabase
    .from("votes")
    .select("question_id, choice")
    .eq("user_id", targetId)
    .in("question_id", qIds);

  const voteMap = new Map(votes?.map((v) => [v.question_id, v.choice]) ?? []);
  let correct = 0;
  for (const p of preds) {
    if (voteMap.get(p.question_id) === p.predicted_choice) correct++;
  }
  return { correct, total: preds.length };
}
