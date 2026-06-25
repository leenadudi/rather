-- Repoint user_id foreign keys from public.users (profile table) to auth.users.
-- With anonymous auth, every voter/commenter is a real auth.users row, but only
-- people who picked a username have a public.users profile row. Pointing these
-- FKs at auth.users lets anonymous and not-yet-onboarded users write.

-- Votes
alter table votes drop constraint if exists votes_user_id_fkey;
alter table votes add constraint votes_user_id_fkey
  foreign key (user_id) references auth.users on delete set null;

-- Comments
alter table comments drop constraint if exists comments_user_id_fkey;
alter table comments add constraint comments_user_id_fkey
  foreign key (user_id) references auth.users on delete set null;

-- Debates (both participants)
alter table debates drop constraint if exists debates_user_a_id_fkey;
alter table debates add constraint debates_user_a_id_fkey
  foreign key (user_a_id) references auth.users on delete set null;

alter table debates drop constraint if exists debates_user_b_id_fkey;
alter table debates add constraint debates_user_b_id_fkey
  foreign key (user_b_id) references auth.users on delete set null;
