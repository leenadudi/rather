-- User-chosen profile color. Avatars render as a solid color (no initials);
-- null falls back to a color derived from the username.
alter table users add column if not exists avatar_color text;
