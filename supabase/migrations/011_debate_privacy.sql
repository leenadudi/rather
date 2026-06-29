-- 1. Require a matching vote before debating. The UI only offers "debate" after
--    you vote, but the RPC is the real primitive — guard it directly so a
--    hand-crafted call can't enter a debate on a side you never picked.
create or replace function join_debate(p_question_id uuid, p_side char, p_user_id uuid)
returns table(debate_id uuid, matched boolean)
language plpgsql security definer as $$
declare w_id uuid;
begin
  if not exists (
    select 1 from votes
    where question_id = p_question_id and user_id = p_user_id and choice = p_side
  ) then
    raise exception 'must vote on this question before debating' using errcode = 'P0001';
  end if;

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

-- 2. Debate message content is private to the two participants. (The debates row
--    itself stays world-readable so the home page can show live queue counts.)
drop policy if exists "read debate_messages" on debate_messages;
drop policy if exists "read own debate_messages" on debate_messages;
create policy "read own debate_messages" on debate_messages
  for select using (
    exists (
      select 1 from debates d
      where d.id = debate_messages.debate_id
        and (d.user_a_id = auth.uid() or d.user_b_id = auth.uid())
    )
  );
