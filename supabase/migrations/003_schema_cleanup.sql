-- Phase 1 schema cleanup: drop dead columns that no app write ever populates.
-- Pre-launch, data is disposable. Coupled schema changes (recovery_*, reports,
-- status, rate_limits, comment_likes unique) land in their own later phases.

alter table votes        drop column if exists device_id;
alter table votes        drop column if exists vote_changed;
alter table comments     drop column if exists device_id;
alter table comment_likes drop column if exists device_id;
alter table debates      drop column if exists device_a_id;
alter table debates      drop column if exists device_b_id;
