-- Phase 5: lightweight fixed-window rate limiting. Writes go only through the
-- service-role server actions, so RLS has no client policies for this table.
create table if not exists rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, action, window_start)
);

alter table rate_limits enable row level security;

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
