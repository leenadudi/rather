# Backend Setup — Manual Steps

The auth/backend rebuild (Phases 1–6) is implemented in code. A few things only
you can do in the Supabase dashboard to make it live. Do them in this order.

## 1. Apply migrations (Supabase → SQL Editor → paste file → Run)

Files are in `supabase/migrations/`. Apply in this order:

| # | File | Notes |
|---|------|-------|
| 1 | `001_anon_auth_fks.sql`, `002_community_questions.sql` | Only if not already applied (the app worked before, so likely done — skip if so) |
| 2 | `003_schema_cleanup.sql` | Drops dead columns. Safe anytime. |
| 3 | `005_atomic_ops.sql` | **Required for voting/liking/debate-join** — those actions call these functions. Apply early. (Safe unless you have duplicate `(comment_id,user_id)` like rows — dedupe first if so.) |
| 4 | `006_drop_recovery.sql` | Drops legacy `users.recovery_code`/`recovery_email`. Apply with the auth changes. |
| 5 | `007_rate_limits.sql` | Enables rate limiting. Until applied, the limiter fails open (app still works). |
| 6 | `008_reports.sql` | Adds `reports` table + `questions.status` for moderation. |
| 7 | `004_rls_lockdown.sql` | **APPLY LAST.** Locks the browser to read-only. Safe now that all writes are server-side. Applying earlier would break admin/auth flows. |

## 2. Auth provider config (for Phase 4 login)

Supabase → Authentication:
1. **Providers → Google:** enable; paste a Google OAuth **Client ID + Secret** (create at Google Cloud Console → Credentials → OAuth client; use the redirect URL Supabase shows).
2. **Settings → enable "Manual linking"** — required, or the in-place anonymous→account upgrade (`linkIdentity`) won't work.
3. **Settings:** ensure **Email** (magic link / OTP) is enabled.
4. **URL Configuration → Redirect URLs:** add `http://localhost:3000/auth/callback` and your production `https://<domain>/auth/callback`.

No new env vars are needed — `.env.local` already has the Supabase keys + `ADMIN_PASSWORD`. Google credentials live in the Supabase dashboard.

## 3. Verify after config
- Vote anonymously → "save account" → Google → returns with the **same** id, votes intact → username onboarding → home.
- Magic-link email path.
- Comment/debate/community/friends prompt sign-in when anonymous.
- Reported community questions hide after 3 reports; admin `/admin` moderation queue can restore/delete.

## Known follow-up (security hardening — your call)
The `/admin` page is gated by HTTP Basic Auth (middleware). The admin **server
actions** (create/delete/hide questions) use the service-role key and rely on
that middleware. The normal flow is protected, but Next.js server actions can in
principle be reached by a crafted POST to `/_next/action` that bypasses the path
check. **Recommended hardening:** add a server-verified admin token argument to
the admin actions, or move admin mutations to Basic-Auth-gated Route Handlers,
or make the admin a real Supabase account checked with `requireAccount` + an
`is_admin` flag. Not blocking for a closed/pre-launch admin, but do this before a
public launch.

## Where the work is documented
- Design spec: `docs/superpowers/specs/2026-06-25-auth-backend-redesign-design.md`
- Per-phase plans: `docs/superpowers/plans/2026-06-25-auth-backend-phase{1..6}-*.md`
- Execution log: `.superpowers/sdd/progress.md`
