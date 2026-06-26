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
  created_at timestamptz default now(),
  unique(comment_id, user_id)
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

-- Rate limits (Phase 5: lightweight fixed-window rate limiting)
create table if not exists rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, action, window_start)
);

-- RPC: increment comment likes atomically
create or replace function increment_comment_likes(cid uuid)
returns void language plpgsql security definer as $$
begin
  update comments set likes = likes + 1 where id = cid;
end;
$$;

-- Atomic vote: upsert (one vote per user/question) then return fresh tallies.
create or replace function cast_vote(p_question_id uuid, p_choice char, p_user_id uuid)
returns table(a int, b int, total int, pct_a int, pct_b int)
language plpgsql security definer as $$
declare va int; vb int; vt int;
begin
  insert into votes(question_id, choice, user_id)
    values (p_question_id, p_choice, p_user_id)
    on conflict (question_id, user_id) do nothing;
  select count(*) filter (where choice = 'A'), count(*) filter (where choice = 'B')
    into va, vb from votes where question_id = p_question_id;
  vt := va + vb;
  return query select va, vb, vt,
    case when vt = 0 then 50 else round(va::numeric / vt * 100)::int end,
    case when vt = 0 then 50 else round(vb::numeric / vt * 100)::int end;
end; $$;

-- Atomic matchmaking: lock a waiting opposite-side debate (SKIP LOCKED so two
-- concurrent joiners cannot claim the same row), else create a waiting row.
create or replace function join_debate(p_question_id uuid, p_side char, p_user_id uuid)
returns table(debate_id uuid, matched boolean)
language plpgsql security definer as $$
declare w_id uuid;
begin
  if p_side = 'A' then
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_b_id is not null
      order by created_at limit 1 for update skip locked;
  else
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_a_id is not null
      order by created_at limit 1 for update skip locked;
  end if;

  if w_id is not null then
    if p_side = 'A' then
      update debates set user_a_id = p_user_id, status = 'active', started_at = now() where id = w_id;
    else
      update debates set user_b_id = p_user_id, status = 'active', started_at = now() where id = w_id;
    end if;
    return query select w_id, true; return;
  end if;

  if p_side = 'A' then
    insert into debates(question_id, user_a_id, status) values (p_question_id, p_user_id, 'waiting') returning id into w_id;
  else
    insert into debates(question_id, user_b_id, status) values (p_question_id, p_user_id, 'waiting') returning id into w_id;
  end if;
  return query select w_id, false;
end; $$;

-- Atomic like: insert-if-absent + increment, so a double-like counts once.
create or replace function like_comment(p_comment_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into comment_likes(comment_id, user_id) values (p_comment_id, p_user_id)
    on conflict (comment_id, user_id) do nothing;
  if found then
    update comments set likes = likes + 1 where id = p_comment_id;
  end if;
end; $$;

-- Atomic increment-and-check for the current fixed window. Returns true if the
-- request is within the limit, false if it exceeds it.
create or replace function check_rate_limit(
  p_user_id uuid, p_action text, p_limit int, p_window_seconds int
) returns boolean language plpgsql security definer as $$
declare w_start timestamptz; c int;
begin
  w_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits(user_id, action, window_start, count)
    values (p_user_id, p_action, w_start, 1)
    on conflict (user_id, action, window_start)
    do update set count = rate_limits.count + 1
    returning count into c;
  return c <= p_limit;
end; $$;

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
alter table rate_limits enable row level security;

-- RLS policies (Phase 2 lockdown: browser read-only; all writes via service-role server actions)
create policy "read questions" on questions for select using (true);
create policy "read votes" on votes for select using (true);
create policy "read comments" on comments for select using (true);
create policy "read debates" on debates for select using (true);
create policy "read debate_messages" on debate_messages for select using (true);
create policy "read users" on users for select using (true);
create policy "read own friend_requests" on friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "read own predictions" on predictions
  for select using (auth.uid() = predictor_id or auth.uid() = target_id);

-- No INSERT/UPDATE/DELETE policies exist for the browser role on any table.
