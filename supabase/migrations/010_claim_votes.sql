-- Lets a visitor's anonymous vote (user_id = null) be reassigned to an account
-- they create later, without inflating the public tally.

-- cast_vote now also returns the id of the relevant vote row, so the client can
-- remember which anonymous row to claim after signup. The return type changes,
-- so the old function must be dropped first (create-or-replace can't do it).
drop function if exists cast_vote(uuid, char, uuid);
create or replace function cast_vote(p_question_id uuid, p_choice char, p_user_id uuid)
returns table(vote_id uuid, a int, b int, total int, pct_a int, pct_b int)
language plpgsql security definer as $$
declare va int; vb int; vt int; v_id uuid;
begin
  insert into votes(question_id, choice, user_id)
    values (p_question_id, p_choice, p_user_id)
    on conflict (question_id, user_id) do nothing
    returning id into v_id;
  -- On conflict no row is returned; a signed-in re-voter already has a row, so
  -- look it up. (Anonymous votes never conflict — NULLs are distinct.)
  if v_id is null and p_user_id is not null then
    select id into v_id from votes where question_id = p_question_id and user_id = p_user_id;
  end if;
  select count(*) filter (where choice = 'A'), count(*) filter (where choice = 'B')
    into va, vb from votes where question_id = p_question_id;
  vt := va + vb;
  return query select v_id, va, vb, vt,
    case when vt = 0 then 50 else round(va::numeric / vt * 100)::int end,
    case when vt = 0 then 50 else round(vb::numeric / vt * 100)::int end;
end; $$;

-- Reassign one still-anonymous vote row to the given account. If the account
-- already voted on that question, drop the anonymous row instead (account wins).
create or replace function claim_vote(p_vote_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare v_qid uuid;
begin
  select question_id into v_qid from votes where id = p_vote_id and user_id is null;
  if v_qid is null then return; end if;  -- already claimed or not found

  if exists (select 1 from votes where question_id = v_qid and user_id = p_user_id) then
    delete from votes where id = p_vote_id;
  else
    update votes set user_id = p_user_id where id = p_vote_id;
  end if;
end; $$;
