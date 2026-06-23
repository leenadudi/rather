export type Choice = "A" | "B";

export type QuestionDimension =
  | "honesty_vs_tact"
  | "autonomy_vs_belonging"
  | "experience_vs_security"
  | "clarity_vs_kindness"
  | "individual_vs_social"
  | "present_vs_future";

export interface Question {
  id: string;
  option_a: string;
  option_b: string;
  published_at: string;
  created_at: string;
  dimension?: QuestionDimension;
  debate_enabled?: boolean;
}

export interface Vote {
  id: string;
  question_id: string;
  choice: Choice;
  user_id: string | null;
  device_id: string | null;
  created_at: string;
  vote_changed?: boolean;
}

export interface User {
  id: string;
  username: string;
  recovery_email?: string;
  created_at: string;
}

export interface Comment {
  id: string;
  question_id: string;
  content: string;
  choice: Choice;
  user_id: string | null;
  device_id: string | null;
  likes: number;
  created_at: string;
  parent_id?: string | null;
  replies?: Comment[];
  liked_by_me?: boolean;
}

export interface CommentLike {
  comment_id: string;
  user_id: string | null;
  device_id: string | null;
}

export type DebateStatus = "waiting" | "active" | "ended" | "flagged";

export interface Debate {
  id: string;
  question_id: string;
  user_a_id: string | null;
  user_b_id: string | null;
  device_a_id: string | null;
  device_b_id: string | null;
  status: DebateStatus;
  started_at: string | null;
  ended_at: string | null;
  flag_count: number;
  created_at: string;
}

export interface DebateMessage {
  id: string;
  debate_id: string;
  sender_side: Choice;
  content: string;
  flagged: boolean;
  created_at: string;
}

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

export interface Prediction {
  id: string;
  predictor_id: string;
  target_id: string;
  question_id: string;
  predicted_choice: Choice;
  created_at: string;
}

export interface VoteCounts {
  a: number;
  b: number;
  total: number;
  pct_a: number;
  pct_b: number;
}

export interface CharacterCard {
  period: string;
  headline: string;
  tension: string;
  dimensions: {
    label_a: string;
    label_b: string;
    pct: number; // 0-100, > 50 = leans A side
    name: QuestionDimension;
  }[];
  stats: {
    questions: number;
    debates: number;
    mind_changes: number;
  };
}
