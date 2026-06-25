-- Community ("explore") questions: user-submitted WYRs that reuse the same
-- questions/votes/comments tables as the daily question. A `type` column
-- separates the daily feed from the community feed, and `author_id` tracks
-- who submitted a community question.

alter table questions add column if not exists type text not null default 'daily';
alter table questions add column if not exists author_id uuid references auth.users on delete set null;

-- Backfill: anything already in the table is a daily question.
update questions set type = 'daily' where type is null;

-- Speeds up the community feed query.
create index if not exists questions_type_created_idx on questions (type, created_at desc);
