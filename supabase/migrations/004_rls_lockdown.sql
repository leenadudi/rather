-- Phase 2 RLS lockdown: the browser (anon key) may READ where appropriate but
-- may NEVER write. All writes go through server actions using the service-role
-- key, which bypasses RLS. This is the security payoff of the server boundary.
--
-- Self-contained + idempotent: it ENABLES row level security on every core table
-- (policies have no effect unless RLS is enabled) and DROPS every existing policy
-- on those tables — regardless of name — before creating the read-only ones. This
-- works even if RLS was never enabled or old policies have unexpected names.

-- 1. Drop ALL existing policies on the core tables (handles any leftover names).
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in (
        'votes','comments','comment_likes','debates','debate_messages',
        'friend_requests','predictions','questions','users'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 2. Ensure RLS is actually ENABLED (without this, dropping write policies does
--    nothing — the table stays wide open).
alter table votes            enable row level security;
alter table comments         enable row level security;
alter table comment_likes    enable row level security;
alter table debates          enable row level security;
alter table debate_messages  enable row level security;
alter table friend_requests  enable row level security;
alter table predictions      enable row level security;
alter table questions        enable row level security;
alter table users            enable row level security;

-- 3. Create SELECT-only policies for the browser. No INSERT/UPDATE/DELETE policy
--    exists for any table, so the anon key cannot write. (comment_likes gets NO
--    policy at all — it is never read client-side.)
create policy "read questions"        on questions       for select using (true);
create policy "read votes"            on votes           for select using (true);
create policy "read comments"         on comments        for select using (true);
create policy "read debates"          on debates         for select using (true);
create policy "read debate_messages"  on debate_messages for select using (true);
create policy "read users"            on users           for select using (true);

create policy "read own friend_requests" on friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "read own predictions" on predictions
  for select using (auth.uid() = predictor_id or auth.uid() = target_id);
