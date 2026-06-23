import { supabase } from "./supabase";
import type { FriendRequest, User } from "@/types";

export async function searchUser(username: string): Promise<User | null> {
  const { data } = await supabase
    .from("users")
    .select("id, username, created_at")
    .eq("username", username)
    .single();
  return data as User | null;
}

export async function sendFriendRequest(fromId: string, toId: string) {
  const { error } = await supabase.from("friend_requests").insert({
    from_user_id: fromId,
    to_user_id: toId,
  });
  return !error;
}

export async function respondToRequest(
  requestId: string,
  status: "accepted" | "declined"
) {
  await supabase
    .from("friend_requests")
    .update({ status })
    .eq("id", requestId);
}

export async function getFriends(userId: string): Promise<User[]> {
  const { data } = await supabase
    .from("friend_requests")
    .select("from_user_id, to_user_id, users!friend_requests_from_user_id_fkey(id, username, created_at)")
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .eq("status", "accepted");

  const friends: User[] = [];
  for (const row of data ?? []) {
    const friendId = row.from_user_id === userId ? row.to_user_id : row.from_user_id;
    if (friendId !== userId) {
      // We'll just return IDs here — caller can enrich
      friends.push({ id: friendId, username: "", created_at: "" });
    }
  }
  return friends;
}

export async function getPendingRequests(userId: string): Promise<FriendRequest[]> {
  const { data } = await supabase
    .from("friend_requests")
    .select("*, from_user:users!friend_requests_from_user_id_fkey(id, username)")
    .eq("to_user_id", userId)
    .eq("status", "pending");
  return (data ?? []) as FriendRequest[];
}
