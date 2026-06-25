# Auth & Backend Redesign — Design

**Date:** 2026-06-25
**Status:** Approved design, ready for implementation planning
**App:** `rather` (Would You Rather) — Next.js 14 + Supabase

## Problem

The app currently has no server/backend layer. The browser talks directly to
Supabase with the anonymous key, and Row Level Security is wide open
(`using(true)` / `with check(true)` on every table). There is no trust
boundary, no server-side validation, and no business logic on the server.

This single fact is the root cause of every symptom the review surfaced:

- **Security:** anyone with the anon key (shipped to every browser) can read,
  alter, or delete anyone's votes, comments, and debates, or force-end a debate.
- **Hacky auth:** fake `@wyr.internal` emails, client-side SHA-256 recovery-code
  hashing, an unverified recovery email, and broken OAuth onboarding.
- **Reliability / races:** client-side debate matchmaking races (two users grab
  the same opponent), best-effort client-side data migration on account upgrade,
  and no validation anywhere.
- **No real backend:** all logic lives in the browser; `createServiceClient()`
  is defined but never used; `device_id` / fingerprint plumbing is dead code.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Auth model | **Hybrid** — anonymous to vote + view results; real account required to comment, debate, submit community questions, and use friends/predictions |
| Account credentials | **OAuth + email magic-link**; username is the public, anonymous-to-others handle. No passwords, no recovery codes. |
| Backend platform | **Stay on Supabase** (Postgres + Auth + Realtime), used properly with a server trust boundary |
| Architecture | **Approach A** — Next.js Server Actions + Route Handlers as the trust boundary; service-role writes server-side; read-only RLS for the browser; atomic Postgres functions for race-prone ops |
| Data state | **Pre-launch, no real data** — clean rebuild via one fresh migration, no backfill |
| Rate limiting | **In scope** — lightweight Postgres-based limiter |
| Community moderation | **In scope** — report-based, post-hoc (live immediately, hidden pending review when reported) |

## Architecture

Four layers, each with one responsibility:

```
BROWSER
  - renders UI
  - READS data + subscribes to realtime via a read-only (anon) key
  - for any CHANGE, calls a server action — never writes to the DB directly

NEXT.JS SERVER  (the trust boundary)
  - reads the session (anonymous vs real account)
  - validates input (zod)
  - enforces rules (account required? rate limited?)
  - writes using the service-role key (kept secret, server-only)

POSTGRES (Supabase)
  - clean schema
  - RLS: browser may READ (some tables), may NEVER write
  - atomic functions for the few race-prone operations

SUPABASE AUTH
  - anonymous sessions, OAuth, email magic-link
  - sessions stored in cookies (via @supabase/ssr)
```

### Code structure changes

- `lib/supabase.ts` splits into:
  - a **browser client** (anon key, read + realtime only), and
  - a **server client** (service-role key, server-only) created per request.
- A new `lib/server/` directory holds server-only code: the service-role client
  (`lib/server/supabase.ts`), the auth guards (`lib/server/auth.ts`), the
  rate-limit helper, and the server actions (one file per domain, each marked
  `"use server"`). The current write functions in `lib/` (`votes.ts`,
  `comments.ts`, `debates.ts`, `community.ts`, `friends.ts`, `predictions.ts`)
  move here and become server actions. Read helpers stay client-side in `lib/`.
- Sessions move from localStorage → cookies so the server can identify the user.
- Middleware refreshes the session on each request.

## Auth & sessions

**Cookie-based sessions.** Replace the default supabase-js client (localStorage
tokens) with `@supabase/ssr`. The session lives in cookies readable by both the
browser and the server. Middleware keeps it fresh. Every server action can now
determine whether the caller is anonymous or a real account.

**Lazy anonymous bootstrap.** Visitors can read the question with no session. On
their first vote, the `castVote` server action creates an anonymous session,
sets the cookie, and records the vote. No sessions are minted for visitors who
never interact.

**In-place account upgrade (key mechanism).** When an anonymous user creates a
real account (OAuth or magic-link), Supabase upgrades the anonymous user **in
place** — linking an OAuth identity or verifying an email keeps the **same user
ID**. Because all votes/comments are keyed to that ID, they remain attached
automatically. This removes the entire manual-migration problem and the bugs it
caused (broken OAuth onboarding, data loss on tab close, the matching race).

```
Anonymous user (id: abc-123) has votes/comments
        │  create account → link Google / verify email
        ▼
Same user (id: abc-123), now permanent, picks a username
        → all prior data still attached (nothing copied, nothing lost)
```

**Username onboarding.** After upgrade, the user picks a username (public,
anonymous-to-others) stored in the `users` profile table. This is the only
onboarding step, with proper unique-violation handling.

**Removed entirely:** fake `@wyr.internal` emails, the `recovery_code` column +
client-side hashing, the unverified `recovery_email`, and all manual
vote/comment migration code. Recovery = "sign in with Google again" or "email me
a magic link."

## Data model

One fresh migration replaces the current schema. Changes by table:

- **`users`** — drop `recovery_code` and `recovery_email`. Keep `id`
  (→ `auth.users`), `username`, `created_at`.
- **`votes`** — drop `device_id` and `vote_changed`. `user_id` always present
  (anon or real). Keep `unique(question_id, user_id)`.
- **`comments`** — drop `device_id`. `user_id` becomes **required** (account
  needed to comment).
- **`comment_likes`** — drop `device_id`. `user_id` required. Add
  `unique(comment_id, user_id)` to prevent double-likes.
- **`debates`** — drop `device_a_id` / `device_b_id`. Participant IDs required.
- **`friend_requests`** — fix the foreign keys so both endpoints reference real
  accounts consistently (currently silently fails).
- **`questions`** — add `status` (`approved` default, `hidden` when reported
  pending review) to support post-hoc moderation. Keep existing columns.
- **`predictions`**, **`debate_messages`** — structurally unchanged.
- **New:** a `reports` table (reporter_id, target type/id, reason, created_at)
  and a rate-limit table (see below).

**Dead code removed:** `lib/fingerprint.ts` and `lib/flagging.ts` (fingerprinting
is unused; content-flagging moves server-side).

## Server API surface

Every browser write becomes a server action. Reads (comments, feeds, results)
stay as client reads under read-only RLS.

**Voting** — *anonymous allowed*
- `castVote(questionId, choice)` — ensures a session (anon if needed), writes via
  the atomic vote function, returns fresh counts.

**Comments** — *account required*
- `postComment(questionId, content, choice, parentId?)`
- `likeComment(commentId)` — atomic + dedup

**Debates** — *account required*
- `joinDebateQueue(questionId, side)` — atomic match-or-create
- `sendDebateMessage(debateId, content)` — verifies participant + content check
- `endDebate(debateId)` / `cancelQueue(debateId)`
- `flagDebateMessage(messageId)` — flagging + auto-end logic, server-side

**Community** — *account required*
- `submitCommunityQuestion(optionA, optionB)` — validation
- `reportContent(targetType, targetId, reason)` — moderation (see below)

**Social** — *account required*
- `sendFriendRequest(toUsername)` / `respondToFriendRequest(requestId, accept)`
- `makePrediction(targetId, questionId, choice)`

**Account**
- `setUsername(username)` — unique-violation handling
- Route handlers for OAuth callback and magic-link verification

**The pattern every action follows:**

```
1. getSession()          → identify caller; reject if account required & anon
2. validate input (zod)  → reject malformed / oversized / empty
3. rate-limit check      → reject abuse
4. perform work via service-role client (or atomic RPC)
5. return typed result   → { ok: true, data } | { ok: false, error }
```

A shared `requireAccount()` / `requireSession()` helper enforces step 1
uniformly.

## Security: RLS + atomic functions

**RLS is inverted from today.** The service-role key (server-only) bypasses RLS,
so legitimate writes succeed. The browser's anon key gets SELECT-only access:

- `questions` (status = approved), `votes`, `comments`, `debates`,
  `debate_messages` → readable (needed for display + realtime).
- `friend_requests`, `predictions`, `reports` → readable only when the caller is
  involved (`auth.uid()` matches).
- **No INSERT / UPDATE / DELETE policies exist for the browser** → every client
  write is blocked at the database, even if the anon key is extracted.

**Three atomic Postgres functions** (`SECURITY DEFINER`, called only by the
server):

- `cast_vote(question_id, choice, user_id)` — upsert + return counts in one step.
- `join_debate(question_id, side, user_id)` — match-or-create using
  `FOR UPDATE SKIP LOCKED`, eliminating the matchmaking race.
- `like_comment(comment_id, user_id)` — insert-like-if-absent + increment,
  atomically (no double-likes, no lost counts).

## Realtime

Realtime is read-only by nature and fits the new model unchanged — it lives in
the browser under SELECT-only RLS.

- **Debate chat:** browser subscribes to `debate_messages` for its `debate_id`;
  messages are *written* by `sendDebateMessage` and *read* via realtime.
- **Live vote counts:** browser subscribes to `votes` for the current question
  and refreshes the tally (existing debounced approach).

**Optional later hardening (out of scope):** raw vote rows carry a `user_id`
(random UUID, low-stakes for this app). If airtight privacy is ever wanted, the
server can broadcast aggregate tallies via Supabase Broadcast instead of the
browser reading vote rows.

## Rate limiting

A lightweight Postgres-based limiter (no extra infrastructure). A table records
`(user_id, action, window_start, count)`; the server checks/increments it as
step 3 of the action pattern. Applied to writes that can be abused: comments,
debate messages, community submissions, friend requests, reports. Limits are
per-user (and per-IP for anonymous voting if needed).

## Community moderation (report-based, post-hoc)

- Community questions go live immediately (`status = approved`).
- Any account can `reportContent(...)`, inserting into `reports`.
- When a question accumulates reports past a threshold, its `status` flips to
  `hidden` (excluded from feeds via RLS + queries) pending admin review.
- The admin panel (already protected by Basic Auth middleware) gains a queue to
  review reported items and approve/remove them.

## Testing

No test infrastructure exists today. Introduce **Vitest** for the server layer:

- Unit tests for each server action's guard + validation logic
  (`requireAccount`, zod schemas, rate-limit checks).
- Tests for the three atomic Postgres functions against a local Supabase
  instance, including concurrency cases (two simultaneous `join_debate` calls
  must not orphan a user; double `like_comment` must count once).
- Smoke test that the browser anon key is denied write access (RLS lockdown).

## Build order (phases)

Each phase is independently shippable.

1. **Foundation** — `@supabase/ssr` session setup, split Supabase client into
   browser (read-only) + server (service-role), session-refresh middleware, lazy
   anonymous bootstrap, the fresh schema migration, and the RLS lockdown.
2. **Writes → server actions** — convert every `lib/` write into a server action
   using the standard pattern + `requireAccount()` guard.
3. **Atomic functions** — `cast_vote`, `join_debate`, `like_comment`.
4. **Account upgrade flow** — in-place OAuth-link + magic-link, username
   onboarding; delete fake-email scheme, recovery codes, and old migration code.
5. **Rate limiting** — Postgres-based limiter wired into the action pattern.
6. **Report-based moderation** — `reports` table, `reportContent` action,
   hide-pending-review, admin review queue.

## Out of scope

- Migrating real production data (none exists; pre-launch clean rebuild).
- Aggregate-tally broadcast for vote-count privacy (optional future hardening).
- Passwordless/passkey auth, email+password auth (OAuth + magic-link chosen).
- Abandoned-debate queue cleanup via cron — noted by the review but not part of
  this auth/backend foundation; can be a follow-up.

## Success criteria

- The browser cannot write to any table directly (RLS denies it); all mutations
  go through validated server actions.
- Anonymous users can vote and view results with zero friction; commenting,
  debating, community submission, and social features require a real account.
- Creating an account preserves all prior anonymous activity with no manual
  migration (same user ID, in place).
- No fake emails, recovery codes, or client-side credential hashing remain.
- Debate matchmaking and comment likes are race-free under concurrent load.
- Writes are rate-limited; reported community questions can be hidden and
  reviewed.
