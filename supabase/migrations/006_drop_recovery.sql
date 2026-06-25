-- Phase 4: recovery is now OAuth / magic-link. Drop the legacy recovery columns.
alter table users drop column if exists recovery_code;
alter table users drop column if exists recovery_email;
