-- Phase 6: report-based moderation.
alter table questions add column if not exists status text not null default 'approved'
  check (status in ('approved', 'hidden'));

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete set null,
  target_type text not null check (target_type in ('question', 'comment')),
  target_id uuid not null,
  reason text,
  created_at timestamptz default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_target_idx on reports (target_type, target_id);

alter table reports enable row level security;
-- Browser may read only its own reports; all writes go through the service role.
create policy "read own reports" on reports for select using (auth.uid() = reporter_id);
