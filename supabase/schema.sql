-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Questions
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  option_a text not null,
  option_b text not null,
  published_at timestamptz not null,
  dimension text check (dimension in (
    'honesty_vs_tact','autonomy_vs_belonging','experience_vs_security',
    'clarity_vs_kindness','individual_vs_social','present_vs_future'
  )),
  debate_enabled boolean default true,
  type text not null default 'daily', -- 'daily' | 'community'
  author_id uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

create index if not exists questions_type_created_idx on questions (type, created_at desc);

-- Users
create table if not exists users (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  recovery_code text not null,
  recovery_email text,
  created_at timestamptz default now()
);

-- Votes
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions on delete cascade,
  choice char(1) check (choice in ('A','B')),
  user_id uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  unique(question_id, user_id)
);

-- Comments
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions on delete cascade,
  parent_id uuid references comments on delete cascade,
  content text not null,
  choice char(1) check (choice in ('A','B')),
  user_id uuid references auth.users on delete set null,
  likes integer default 0,
  created_at timestamptz default now()
);

-- Comment likes
create table if not exists comment_likes (
  comment_id uuid references comments on delete cascade,
  user_id uuid,
  created_at timestamptz default now()
);

-- Debates
create table if not exists debates (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions on delete cascade,
  user_a_id uuid references auth.users on delete set null,
  user_b_id uuid references auth.users on delete set null,
  status text default 'waiting' check (status in ('waiting','active','ended','flagged')),
  started_at timestamptz,
  ended_at timestamptz,
  flag_count integer default 0,
  created_at timestamptz default now()
);

-- Debate messages
create table if not exists debate_messages (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references debates on delete cascade,
  sender_side char(1) check (sender_side in ('A','B')),
  content text not null,
  flagged boolean default false,
  created_at timestamptz default now()
);

-- Friend requests
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users on delete cascade,
  to_user_id uuid references users on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique(from_user_id, to_user_id)
);

-- Predictions
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  predictor_id uuid references users on delete cascade,
  target_id uuid references users on delete cascade,
  question_id uuid references questions on delete cascade,
  predicted_choice char(1) check (predicted_choice in ('A','B')),
  created_at timestamptz default now(),
  unique(predictor_id, target_id, question_id)
);

-- RPC: increment comment likes atomically
create or replace function increment_comment_likes(cid uuid)
returns void language plpgsql security definer as $$
begin
  update comments set likes = likes + 1 where id = cid;
end;
$$;

-- RLS: enable on all tables
alter table questions enable row level security;
alter table users enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;
alter table comment_likes enable row level security;
alter table debates enable row level security;
alter table debate_messages enable row level security;
alter table friend_requests enable row level security;
alter table predictions enable row level security;

-- RLS policies (permissive for now — tighten per table as needed)
create policy "public read questions" on questions for select using (true);
create policy "public read votes" on votes for select using (true);
create policy "public insert votes" on votes for insert with check (true);
create policy "public read comments" on comments for select using (true);
create policy "public insert comments" on comments for insert with check (true);
create policy "public read debates" on debates for select using (true);
create policy "public insert debates" on debates for insert with check (true);
create policy "public update debates" on debates for update using (true);
create policy "public read debate_messages" on debate_messages for select using (true);
create policy "public insert debate_messages" on debate_messages for insert with check (true);
create policy "public update debate_messages" on debate_messages for update using (true);
create policy "public insert comment_likes" on comment_likes for insert with check (true);
create policy "public read friend_requests" on friend_requests for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "auth insert friend_requests" on friend_requests for insert with check (auth.uid() = from_user_id);
create policy "auth update friend_requests" on friend_requests for update using (auth.uid() = to_user_id);
create policy "public read predictions" on predictions for select using (true);
create policy "auth insert predictions" on predictions for insert with check (auth.uid() = predictor_id);
create policy "users read own" on users for select using (true);
create policy "users insert own" on users for insert with check (auth.uid() = id);
