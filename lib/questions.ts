import { supabase } from "./supabase";
import type { Question } from "@/types";

export async function getTodayQuestion(): Promise<Question | null> {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("type", "daily")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  return data as Question | null;
}

export async function getRecentQuestions(limit = 7): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("type", "daily")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Question[];
}
