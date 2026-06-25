-- Phase 3: atomic operations for the race-prone writes.

-- Dedup support for likes.
alter table comment_likes add constraint comment_likes_unique unique (comment_id, user_id);

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
