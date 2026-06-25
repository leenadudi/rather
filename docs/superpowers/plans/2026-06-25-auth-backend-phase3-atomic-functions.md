# Auth & Backend Redesign — Phase 3: Atomic Functions + Server-Authoritative Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Make anonymous identity server-authoritative (closing the cold-start split-identity race from Phase 2's review), and make the three concurrency-sensitive writes — vote, debate matchmaking, comment like — atomic via Postgres functions.

**Architecture:** Builds on Phase 2's server actions. A new `startSession` server action becomes the single minter of anonymous identity; the client's `ensureSession` calls it instead of minting client-side. Three `SECURITY DEFINER` Postgres functions (`cast_vote`, `join_debate`, `like_comment`) move the racy logic into the database; the corresponding server actions call them via `rpc()`. A `unique(comment_id, user_id)` constraint backs `like_comment`'s dedup.

**Tech Stack:** Next.js 14 server actions, Supabase Postgres (plpgsql), `@supabase/ssr`, Vitest.

## Global Constraints

- `@/*` → repo root. Server-only files: `import "server-only";`. Server-action files: `"use server";`, only `async` exports.
- Actions derive identity server-side via `ensureAnonUser()`; never accept a client `userId`.
- Migrations are written but NOT applied to the live DB by the implementer (no DB connection string). The controller applies them. Migration 005's atomic functions are `SECURITY DEFINER` (bypass RLS) and called only from server actions.
- Tests hermetic: mock `@/lib/server/supabase`/`@/lib/server/auth`. RPC calls are asserted via the mock.
- Commit after each task with the exact message; stage only listed files; never `git add -A`.

## File Structure (Phase 3)

- Create `lib/server/session.ts` — `"use server"`; `startSession()`.
- Modify `lib/anon.ts` — `ensureSession` calls `startSession` instead of `signInAnonymously`.
- Create `lib/server/session.test.ts`.
- Create `supabase/migrations/005_atomic_ops.sql` — `comment_likes` unique + `cast_vote`/`join_debate`/`like_comment` functions.
- Modify `supabase/schema.sql` — add the unique constraint + function definitions.
- Modify `lib/server/votes.ts`, `lib/server/debates.ts`, `lib/server/comments.ts` — call the RPCs; update their tests.

---

### Task 1: Server-authoritative anonymous session (fixes C1)

**Files:**
- Create: `lib/server/session.ts`, `lib/server/session.test.ts`
- Modify: `lib/anon.ts`

**Interfaces:**
- Produces: `startSession(): Promise<ActionResult<{ userId: string }>>` (from `@/lib/server/session`) — runs `ensureAnonUser()` server-side (minting + setting the cookie if needed) and returns the id.
- Changes: `ensureSession(): Promise<string>` (from `@/lib/anon`) now calls `startSession()` and returns `data.userId`, instead of calling `supabase.auth.signInAnonymously()` directly. This makes the server the single source of anonymous identity; the cookie it sets propagates to the cookie-based browser client.

- [ ] **Step 1: Write the failing test for `startSession`**

Create `lib/server/session.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
const { ensureAnonUser } = vi.hoisted(() => ({ ensureAnonUser: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
import { startSession } from "@/lib/server/session";

beforeEach(() => ensureAnonUser.mockReset());

describe("startSession", () => {
  it("returns the server-derived anon user id", async () => {
    ensureAnonUser.mockResolvedValue({ id: "srv-1", isAnonymous: true });
    const r = await startSession();
    expect(r).toEqual({ ok: true, data: { userId: "srv-1" } });
  });
  it("returns a fail result when auth fails", async () => {
    ensureAnonUser.mockRejectedValue(new (await import("@/lib/server/result")).ActionError("auth_failed", "no"));
    const r = await startSession();
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/server/session.ts`**

```typescript
"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { run } from "@/lib/server/run";
import type { ActionResult } from "@/lib/server/result";

// The single server-authoritative entrypoint for anonymous identity. The client
// calls this (via lib/anon.ts) instead of minting its own session, so the
// browser and server never create competing anonymous users.
export async function startSession(): Promise<ActionResult<{ userId: string }>> {
  return run(async () => {
    const user = await ensureAnonUser();
    return { userId: user.id };
  });
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Rewrite `lib/anon.ts`**

Replace the body of `ensureSession` so it no longer calls `signInAnonymously` directly. New `lib/anon.ts`:
```typescript
import { startSession } from "@/lib/server/session";

// Returns the current anon/real user id, asking the SERVER to establish the
// session (so the browser never mints a competing anonymous identity). The
// cookie the server sets is shared with the cookie-based browser client.
export async function ensureSession(): Promise<string> {
  const res = await startSession();
  if (!res.ok) throw new Error("auth failed: " + res.error);
  return res.data.userId;
}
```

- [ ] **Step 6: Type-check + verify** — `npx tsc --noEmit` → 0. With the dev server running, load `/` and vote; confirm the vote registers and on reload the page shows your prior choice (same identity client-read ↔ server-write). Confirm no duplicate anonymous users are created for a single visit (one vote → one identity).

- [ ] **Step 7: Commit**

```bash
git add lib/server/session.ts lib/server/session.test.ts lib/anon.ts
git commit -m "fix: make anonymous identity server-authoritative via startSession"
```

---

### Task 2: Atomic Postgres functions migration

**Files:**
- Create: `supabase/migrations/005_atomic_ops.sql`
- Modify: `supabase/schema.sql`

**Interfaces:** Postgres functions callable via `rpc`:
- `cast_vote(p_question_id uuid, p_choice char, p_user_id uuid)` → returns one row `(a int, b int, total int, pct_a int, pct_b int)`.
- `join_debate(p_question_id uuid, p_side char, p_user_id uuid)` → returns one row `(debate_id uuid, matched boolean)`.
- `like_comment(p_comment_id uuid, p_user_id uuid)` → `void`.

- [ ] **Step 1: Write `supabase/migrations/005_atomic_ops.sql`**

```sql
-- Phase 3: atomic operations for the race-prone writes.

-- Dedup support for likes.
alter table comment_likes add constraint comment_likes_unique unique (comment_id, user_id);

-- Atomic vote: upsert (one vote per user/question) then return fresh tallies.
create or replace function cast_vote(p_question_id uuid, p_choice char, p_user_id uuid)
returns table(a int, b int, total int, pct_a int, pct_b int)
language plpgsql security definer as $$
declare va int; vb int; vt int;
begin
  insert into votes(question_id, choice, user_id)
    values (p_question_id, p_choice, p_user_id)
    on conflict (question_id, user_id) do nothing;
  select count(*) filter (where choice = 'A'), count(*) filter (where choice = 'B')
    into va, vb from votes where question_id = p_question_id;
  vt := va + vb;
  return query select va, vb, vt,
    case when vt = 0 then 50 else round(va::numeric / vt * 100)::int end,
    case when vt = 0 then 50 else round(vb::numeric / vt * 100)::int end;
end; $$;

-- Atomic matchmaking: lock a waiting opposite-side debate (SKIP LOCKED so two
-- concurrent joiners cannot claim the same row), else create a waiting row.
create or replace function join_debate(p_question_id uuid, p_side char, p_user_id uuid)
returns table(debate_id uuid, matched boolean)
language plpgsql security definer as $$
declare w_id uuid;
begin
  if p_side = 'A' then
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_b_id is not null
      order by created_at limit 1 for update skip locked;
  else
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_a_id is not null
      order by created_at limit 1 for update skip locked;
  end if;

  if w_id is not null then
    if p_side = 'A' then
      update debates set user_a_id = p_user_id, status = 'active', started_at = now() where id = w_id;
    else
      update debates set user_b_id = p_user_id, status = 'active', started_at = now() where id = w_id;
    end if;
    return query select w_id, true; return;
  end if;

  if p_side = 'A' then
    insert into debates(question_id, user_a_id, status) values (p_question_id, p_user_id, 'waiting') returning id into w_id;
  else
    insert into debates(question_id, user_b_id, status) values (p_question_id, p_user_id, 'waiting') returning id into w_id;
  end if;
  return query select w_id, false;
end; $$;

-- Atomic like: insert-if-absent + increment, so a double-like counts once.
create or replace function like_comment(p_comment_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into comment_likes(comment_id, user_id) values (p_comment_id, p_user_id)
    on conflict (comment_id, user_id) do nothing;
  if found then
    update comments set likes = likes + 1 where id = p_comment_id;
  end if;
end; $$;
```

> Note: `join_debate`'s waiting-match condition is corrected from the old client logic — it matches a waiting row where the **opposite** side is filled (so an A-joiner matches a row that already has `user_b_id`, and vice-versa).

- [ ] **Step 2: (Controller) Apply migration 005 in the Supabase dashboard.** Implementer notes it pending.

- [ ] **Step 3: Sync `supabase/schema.sql`** — add `unique(comment_id, user_id)` to the `comment_likes` table definition, and append the three function definitions (replace the existing `increment_comment_likes` function block region by adding these alongside it; keep `increment_comment_likes` for now as other code may still reference it — verify with grep and remove only if unused).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_atomic_ops.sql supabase/schema.sql
git commit -m "feat: add atomic cast_vote/join_debate/like_comment Postgres functions"
```

---

### Task 3: Route server actions through the atomic RPCs

**Files:**
- Modify: `lib/server/votes.ts`, `lib/server/votes.test.ts`
- Modify: `lib/server/debates.ts`, `lib/server/debates.test.ts`
- Modify: `lib/server/comments.ts`, `lib/server/comments.test.ts`

**Interfaces:** unchanged public signatures (`castVote`, `joinDebateQueue`, `likeComment`); internals now call `rpc`.

- [ ] **Step 1: Update `castVote` to call the RPC**

In `lib/server/votes.ts`, replace the upsert + manual count block with:
```typescript
const { data, error } = await db.rpc("cast_vote", {
  p_question_id: input.questionId,
  p_choice: input.choice,
  p_user_id: user.id,
});
if (error) throw error;
const row = (Array.isArray(data) ? data[0] : data) as { a: number; b: number; total: number; pct_a: number; pct_b: number };
return { a: row.a, b: row.b, total: row.total, pct_a: row.pct_a, pct_b: row.pct_b };
```
This also resolves the prior "swallowed upsert error" note — the RPC error is now surfaced.

- [ ] **Step 2: Update `castVote` test** — change the mock so `db.rpc` is a spy returning `{ data: [{ a: 2, b: 1, total: 3, pct_a: 67, pct_b: 33 }], error: null }`; assert `rpc` was called with `cast_vote` and the three `p_*` args, that invalid input still rejects before `rpc`, and that `r.data.total === 3`.

- [ ] **Step 3: Update `joinDebateQueue` to call the RPC**

In `lib/server/debates.ts`, replace the select/update/insert match-or-create block in `joinDebateQueue` with:
```typescript
const { data, error } = await db.rpc("join_debate", {
  p_question_id: input.questionId,
  p_side: input.side,
  p_user_id: user.id,
});
if (error) throw error;
const row = (Array.isArray(data) ? data[0] : data) as { debate_id: string; matched: boolean };
return { debateId: row.debate_id, matched: row.matched };
```
Leave `sendDebateMessage`, `endDebate`, `flagDebateMessage`, `cancelQueue`, and `loadParticipantSide` unchanged.

- [ ] **Step 4: Update `joinDebateQueue` test** — mock `db.rpc` returning `{ data: [{ debate_id: "d1", matched: true }], error: null }`; assert it was called with `join_debate` + the args and returns `{ debateId: "d1", matched: true }`. Keep the existing `sendDebateMessage` participant tests.

- [ ] **Step 5: Update `likeComment` to call the RPC**

In `lib/server/comments.ts`, replace the `comment_likes` insert + `increment_comment_likes` rpc with:
```typescript
const { error } = await db.rpc("like_comment", { p_comment_id: input.commentId, p_user_id: user.id });
if (error) throw error;
return null;
```
Leave `postComment` unchanged.

- [ ] **Step 6: Update `likeComment` test** — assert `db.rpc` called with `like_comment` + `{ p_comment_id, p_user_id }`.

- [ ] **Step 7: Type-check + full test run** — `npx tsc --noEmit` → 0; `npm run test:run` → all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/server/votes.ts lib/server/votes.test.ts lib/server/debates.ts lib/server/debates.test.ts lib/server/comments.ts lib/server/comments.test.ts
git commit -m "feat: route vote/debate/like actions through atomic Postgres functions"
```

---

## Self-Review

- **Spec coverage:** server-authoritative session / C1 fix (Task 1) ✓; `comment_likes` unique + three atomic functions (Task 2) ✓; actions routed through RPCs, M1 upsert-error note resolved (Task 3) ✓.
- **Placeholder scan:** all SQL + TS shown in full; test changes specify exact mock shapes and assertions.
- **Type consistency:** RPC return rows mapped to the same `VoteCounts` / `{debateId, matched}` shapes the call sites already consume; action signatures unchanged.

## Notes for later phases

- Phase 4: switch comment/debate/community/social actions from `ensureAnonUser()` to `requireAccount()`; rewrite the auth/onboarding flows (replacing the client-side `users` insert / vote-comment migration / recovery code) to use in-place OAuth-link + magic-link; drop `users.recovery_code`/`recovery_email`.
- Migration 004 (RLS lockdown) is applied only after Phase 4 + admin writes (Phase 6) are server-side.
- `increment_comment_likes` may be removable once nothing references it (verify in a later cleanup).
