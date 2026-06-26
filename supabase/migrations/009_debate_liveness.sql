-- Phase: debate queue liveness. Add a heartbeat timestamp so matchmaking only
-- pairs joiners with participants who are still online. A waiting client pings
-- last_seen_at every ~10s; rows not pinged within 30s are treated as gone.

alter table debates
  add column if not exists last_seen_at timestamptz not null default now();

-- Redefine join_debate (supersedes 005) to skip stale waiting rows. The only
-- change from 005 is the `last_seen_at > now() - interval '30 seconds'` predicate
-- on the two waiting-row lookups. Insert branch and SKIP LOCKED are unchanged.
create or replace function join_debate(p_question_id uuid, p_side char, p_user_id uuid)
returns table(debate_id uuid, matched boolean)
language plpgsql security definer as $$
declare w_id uuid;
begin
  if p_side = 'A' then
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_b_id is not null
        and last_seen_at > now() - interval '30 seconds'
      order by created_at limit 1 for update skip locked;
  else
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_a_id is not null
        and last_seen_at > now() - interval '30 seconds'
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
