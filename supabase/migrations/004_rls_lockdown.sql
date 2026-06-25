-- Phase 2 RLS lockdown: the browser (anon key) may READ where appropriate but
-- may NEVER write. All writes go through server actions using the service-role
-- key, which bypasses RLS. This is the security payoff of the server boundary.

-- Drop the old permissive write/read policies.
drop policy if exists "public insert votes" on votes;
drop policy if exists "public insert comments" on comments;
drop policy if exists "public insert comment_likes" on comment_likes;
drop policy if exists "public insert debates" on debates;
drop policy if exists "public update debates" on debates;
drop policy if exists "public insert debate_messages" on debate_messages;
drop policy if exists "public update debate_messages" on debate_messages;
drop policy if exists "auth insert friend_requests" on friend_requests;
drop policy if exists "auth update friend_requests" on friend_requests;
drop policy if exists "auth insert predictions" on predictions;
drop policy if exists "users insert own" on users;

-- Keep / (re)create SELECT-only policies for the browser.
drop policy if exists "public read questions" on questions;
create policy "read questions" on questions for select using (true);
drop policy if exists "public read votes" on votes;
create policy "read votes" on votes for select using (true);
drop policy if exists "public read comments" on comments;
create policy "read comments" on comments for select using (true);
drop policy if exists "public read debates" on debates;
create policy "read debates" on debates for select using (true);
drop policy if exists "public read debate_messages" on debate_messages;
create policy "read debate_messages" on debate_messages for select using (true);
drop policy if exists "users read own" on users;
create policy "read users" on users for select using (true);

-- Friend requests + predictions: readable only by the involved user.
drop policy if exists "public read friend_requests" on friend_requests;
create policy "read own friend_requests" on friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
drop policy if exists "public read predictions" on predictions;
create policy "read own predictions" on predictions
  for select using (auth.uid() = predictor_id or auth.uid() = target_id);

-- No INSERT/UPDATE/DELETE policies exist for the browser role on any table now.
