# Debate Queue Liveness (Option A) — Design

**Date:** 2026-06-25
**Status:** Approved, pending spec review

## Problem

Debate matchmaking pairs a joiner with a *waiting row*, not a *live person*. A user
can create a `waiting` debate row and then leave (close tab, lose signal, background
the app). The row stays `status = 'waiting'` forever because the queue page only tears
down its realtime channel on unmount — it never cancels the queue. A later joiner then
matches this ghost row, flips the debate to `active`, and ends up "debating" someone who
is no longer there. The `DebateChat` silence timer (60s warn / 90s end) eventually kills
it, but it is a poor experience and the "waiting to debate" counter also over-counts ghosts.

Sign-in gating and the atomic matchmaker (`join_debate`, `FOR UPDATE SKIP LOCKED`) are
already correct and built — this design does **not** touch them. This is purely about
liveness: only match people who are actually online.

## Why not a simple "ignore old rows" filter

Filtering waiting rows by `created_at` age is incorrect: someone legitimately waiting
45s is still present, but a creation-time filter would make new joiners skip their row,
so two live people both wait forever and never match. Creation time cannot distinguish
"left" from "still waiting." The liveness signal must be a **heartbeat**, not row age.

## Design

A lightweight heartbeat — one timestamp column, a client interval, and a freshness
filter in matchmaking. No Supabase Realtime Presence channels (that is Option B, deferred).

### 1. Schema — new migration `009_debate_liveness.sql`

```sql
alter table debates
  add column if not exists last_seen_at timestamptz not null default now();
```

The column tracks the last time the waiting participant pinged. Default `now()` means
freshly created waiting rows are immediately considered live.

### 2. Heartbeat server action — `lib/server/debates.ts`

```ts
export async function heartbeatQueue(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await requireAccount();
    const db = createServiceSupabase();
    await loadParticipantSide(db, debateId, user.id); // throws if not a participant
    await db.from("debates")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", debateId)
      .eq("status", "waiting"); // no-op once matched/ended
    return null;
  });
}
```

Reuses the existing `loadParticipantSide` guard so only a participant can refresh their
own row. The `status = 'waiting'` filter makes it a no-op after a match, so a late ping
cannot resurrect an ended row.

### 3. Queue page — `app/debate/queue/page.tsx`

While `debate.status === 'waiting'`:
- `setInterval` every **10s** calling `heartbeatQueue(debate.id)`.
- Best-effort `cancelQueue(debate.id)` on component unmount **and** on `pagehide` /
  `visibilitychange → hidden` (covers tab close and mobile backgrounding).
- A `matchedRef` (set when we route into a matched/active debate, both in the
  `matched === true` branch and the realtime `status === 'active'` handler) guards the
  cleanup so navigating *into* a matched debate does NOT cancel the now-active debate.

Heartbeat is best-effort and advisory; the source of truth for liveness is `last_seen_at`
being recent. If the cancel event never fires (hard crash), the heartbeat simply stops and
the row ages out of the freshness window on its own.

### 4. Matchmaker — `join_debate` redefined in the same migration `009`

Migration `009_debate_liveness.sql` contains both the column add (§1) and a
`create or replace function join_debate(...)` that supersedes the 005 version.
Add a freshness predicate to the waiting-row lookup (both side branches):

```sql
... where question_id = p_question_id
      and status = 'waiting'
      and user_b_id is not null            -- (user_a_id is not null for side B)
      and last_seen_at > now() - interval '30 seconds'
    order by created_at limit 1 for update skip locked;
```

The insert branch and `FOR UPDATE SKIP LOCKED` are unchanged. Net: you only get paired
with someone who pinged within the last 30s.

### 5. Honest counts — `lib/debates.ts` `getQueueCounts`

Add `.gt("last_seen_at", <now - 30s ISO>)` to the waiting-row query so the
"waiting to debate" number stops counting ghosts. Computed in JS as
`new Date(Date.now() - 30_000).toISOString()`.

## Thresholds

- Heartbeat interval: **10s**
- Freshness window: **30s** (two missed pings of slack before considered gone)

Chosen for slack against transient jank; tune later if needed. The 30s constant appears
in the RPC and in `getQueueCounts` — keep them in sync.

## Behavior summary

Leave the queue → heartbeat stops → within 30s the row is invisible to both matchmaking
and the counter. Works even on a hard crash, since it does not depend on the cancel event.

## Out of scope (deferred)

- **Option B:** presence-channel-backed queue (survives without polling; more moving parts).
- Background sweep to set stale `waiting` rows to `ended` (not needed — stale rows are
  ignored everywhere; purely cosmetic for DB hygiene).
- Self-match hardening in `join_debate` (not reachable in normal flow, since side is fixed
  by the user's vote).

## Testing

- `heartbeatQueue`: returns `account_required` and performs no write when not authed;
  no-ops on a non-`waiting` row; rejects a non-participant via `loadParticipantSide`.
  Follow the existing mock-the-db pattern in `lib/server/*.test.ts`.
- Matchmaker freshness: a waiting row with `last_seen_at` older than 30s is not matched
  (joiner creates a new waiting row instead); a fresh one is matched. Exercised against
  the RPC.
- `getQueueCounts`: excludes rows older than the window.
