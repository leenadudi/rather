# Debate Queue Liveness (Option A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only match debate joiners with participants who are actually online, via a lightweight heartbeat.

**Architecture:** A waiting client pings a `last_seen_at` timestamp on its `debates` row every 10s. Matchmaking and the queue counter only consider waiting rows whose `last_seen_at` is within the last 30s, so ghosts (closed tab / lost signal) age out and are never matched. Best-effort cancel-on-leave is added too, but the timestamp is the source of truth.

**Tech Stack:** Next.js 14 (App Router, client components), Supabase (Postgres + service-role server actions, plpgsql RPC), Zod validation, Vitest.

## Global Constraints

- Heartbeat interval: **10 seconds**. Freshness window: **30 seconds**. The 30s constant appears in the `join_debate` RPC and in `getQueueCounts` — keep them identical.
- All debate writes go through service-role server actions in `lib/server/debates.ts` guarded by `requireAccount()` and `loadParticipantSide()`. Do not add client-side writes (RLS lockdown forbids it).
- Server actions return `ActionResult<T>` via `run(...)`; validate input with `parseOrThrow(schema, ...)`.
- Follow the existing test pattern in `lib/server/comments.test.ts` (hoisted `vi.fn` mocks for `requireAccount` / `createServiceSupabase`).

---

### Task 1: Migration 009 — `last_seen_at` column + freshness-aware `join_debate`

**Files:**
- Create: `supabase/migrations/009_debate_liveness.sql`

**Interfaces:**
- Produces: `debates.last_seen_at timestamptz not null default now()`; redefined `join_debate(p_question_id uuid, p_side char, p_user_id uuid) returns table(debate_id uuid, matched boolean)` that ignores waiting rows with `last_seen_at <= now() - interval '30 seconds'`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/009_debate_liveness.sql`:

```sql
-- Phase: debate queue liveness. Add a heartbeat timestamp so matchmaking only
-- pairs joiners with participants who are still online. A waiting client pings
-- last_seen_at every ~10s; rows not pinged within 30s are treated as gone.

alter table debates
  add column if not exists last_seen_at timestamptz not null default now();

-- Redefine join_debate (supersedes 005) to skip stale waiting rows. The only
-- change from 005 is the `last_seen_at > now() - interval '30 seconds'` predicate
-- on the two waiting-row lookups. Insert branch and SKIP LOCKED are unchanged.
create or replace function join_debate(p_question_id uuid, p_side char, p_user_id uuid)
returns table(debate_id uuid, matched boolean)
language plpgsql security definer as $$
declare w_id uuid;
begin
  if p_side = 'A' then
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_b_id is not null
        and last_seen_at > now() - interval '30 seconds'
      order by created_at limit 1 for update skip locked;
  else
    select id into w_id from debates
      where question_id = p_question_id and status = 'waiting' and user_a_id is not null
        and last_seen_at > now() - interval '30 seconds'
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
```

- [ ] **Step 2: Apply the migration**

Apply against the Supabase database following the project's existing process in `SETUP.md` (paste into the Supabase SQL editor, or run via the configured migration tooling). This is the same manual flow used for migrations 001–008.

- [ ] **Step 3: Verify column and function exist**

In the Supabase SQL editor run:

```sql
select column_name from information_schema.columns
  where table_name = 'debates' and column_name = 'last_seen_at';
-- Expected: one row, "last_seen_at"

select pg_get_functiondef('join_debate(uuid,char,uuid)'::regprocedure) ilike '%last_seen_at > now()%';
-- Expected: t
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_debate_liveness.sql
git commit -m "feat: 009 adds debates.last_seen_at + freshness filter in join_debate"
```

---

### Task 2: `heartbeatQueue` server action

**Files:**
- Modify: `lib/server/validation.ts` (add `heartbeatSchema`)
- Modify: `lib/server/debates.ts` (add `heartbeatQueue`)
- Test: `lib/server/debates.test.ts` (create)

**Interfaces:**
- Consumes: `requireAccount()`, `createServiceSupabase()`, `loadParticipantSide(db, debateId, userId)`, `run`, `parseOrThrow`, `ActionResult` — all already in `lib/server/debates.ts`.
- Produces: `heartbeatQueue(debateId: string): Promise<ActionResult<null>>` — updates `last_seen_at = now()` on the caller's `debates` row only while `status = 'waiting'`.

- [ ] **Step 1: Add the validation schema**

In `lib/server/validation.ts`, after the `debateMessageSchema` line (line 16), add:

```ts
export const heartbeatSchema = z.object({ debateId: uuid });
```

- [ ] **Step 2: Write the failing test**

Create `lib/server/debates.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionError } from "@/lib/server/result";

const { requireAccount, update, single } = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: () => ({
      // loadParticipantSide: .select(...).eq("id", x).single()
      select: () => ({ eq: () => ({ single }) }),
      // heartbeat: .update({...}).eq("id", x).eq("status", "waiting")  (awaited)
      update: (row: unknown) => {
        update(row);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    }),
  }),
}));

import { heartbeatQueue } from "@/lib/server/debates";

const DEBATE = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  [requireAccount, update, single].forEach((m) => m.mockReset());
  requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false });
  single.mockResolvedValue({ data: { user_a_id: "u1", user_b_id: null } });
});

describe("heartbeatQueue", () => {
  it("rejects an invalid debateId without writing", async () => {
    const r = await heartbeatQueue("not-a-uuid");
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("updates last_seen_at for a participant", async () => {
    const r = await heartbeatQueue(DEBATE);
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ last_seen_at: expect.any(String) })
    );
  });

  it("returns account_required and performs no write when requireAccount rejects", async () => {
    requireAccount.mockRejectedValue(new ActionError("account_required", "you need an account to do that"));
    const r = await heartbeatQueue(DEBATE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a non-participant without writing", async () => {
    single.mockResolvedValue({ data: { user_a_id: "someone-else", user_b_id: null } });
    const r = await heartbeatQueue(DEBATE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_participant");
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/server/debates.test.ts`
Expected: FAIL — `heartbeatQueue` is not exported from `@/lib/server/debates`.

- [ ] **Step 4: Implement `heartbeatQueue`**

In `lib/server/debates.ts`, update the validation import to include `heartbeatSchema`:

```ts
import { parseOrThrow, joinDebateSchema, debateMessageSchema, heartbeatSchema } from "@/lib/server/validation";
```

Then add this function (after `joinDebateQueue`, before or after the other actions):

```ts
export async function heartbeatQueue(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(heartbeatSchema, { debateId });
    const user = await requireAccount();
    const db = createServiceSupabase();
    await loadParticipantSide(db, input.debateId, user.id); // throws not_participant
    await db.from("debates")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", input.debateId)
      .eq("status", "waiting"); // no-op once matched/ended
    return null;
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/server/debates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/server/validation.ts lib/server/debates.ts lib/server/debates.test.ts
git commit -m "feat: heartbeatQueue server action pings last_seen_at while waiting"
```

---

### Task 3: Exclude stale rows from `getQueueCounts`

**Files:**
- Modify: `lib/debates.ts:13-26`
- Test: `lib/debates.test.ts` (create)

**Interfaces:**
- Consumes: browser `supabase` client from `./supabase`.
- Produces: `getQueueCounts` now adds `.gt("last_seen_at", <iso 30s ago>)` to the waiting-row query; signature unchanged (`(questionId: string) => Promise<{ a: number; b: number }>`).

- [ ] **Step 1: Write the failing test**

Create `lib/debates.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { gt } = vi.hoisted(() => ({ gt: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: (col: string, val: string) => {
              gt(col, val);
              return Promise.resolve({
                data: [
                  { user_a_id: "a1", user_b_id: null },
                  { user_a_id: null, user_b_id: "b1" },
                  { user_a_id: "a2", user_b_id: null },
                ],
              });
            },
          }),
        }),
      }),
    }),
  },
}));

import { getQueueCounts } from "@/lib/debates";

beforeEach(() => gt.mockReset());

describe("getQueueCounts", () => {
  it("filters waiting rows by a recent last_seen_at and counts per side", async () => {
    const res = await getQueueCounts("q1");
    expect(gt).toHaveBeenCalledWith("last_seen_at", expect.any(String));
    expect(res).toEqual({ a: 2, b: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/debates.test.ts`
Expected: FAIL — current query has no `.gt(...)`, so the mock's `eq().eq()` returns no `gt` and the call throws / mismatches.

- [ ] **Step 3: Implement the freshness filter**

In `lib/debates.ts`, replace the `getQueueCounts` query (lines 13-26) so the Supabase chain becomes:

```ts
export async function getQueueCounts(questionId: string): Promise<{ a: number; b: number }> {
  const freshSince = new Date(Date.now() - 30_000).toISOString();
  const { data } = await supabase
    .from("debates")
    .select("user_a_id, user_b_id")
    .eq("question_id", questionId)
    .eq("status", "waiting")
    .gt("last_seen_at", freshSince);

  let a = 0, b = 0;
  for (const row of data ?? []) {
    if (row.user_a_id) a++;
    if (row.user_b_id) b++;
  }
  return { a, b };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/debates.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/debates.ts lib/debates.test.ts
git commit -m "feat: getQueueCounts ignores stale waiting rows (30s window)"
```

---

### Task 4: Queue page — heartbeat loop + cancel-on-leave

**Files:**
- Modify: `app/debate/queue/page.tsx`

**Interfaces:**
- Consumes: `heartbeatQueue` (Task 2), existing `cancelQueue`, `joinDebateQueue`.
- Produces: client behavior only — no new exports.

- [ ] **Step 1: Import `heartbeatQueue`**

In `app/debate/queue/page.tsx`, update the server-actions import (line 7):

```ts
import { joinDebateQueue, cancelQueue, heartbeatQueue } from "@/lib/server/debates";
```

- [ ] **Step 2: Add a `matchedRef`**

Add `useRef` to the React import, and inside `QueueContent`, near the other state declarations, add:

```ts
const matchedRef = useRef(false);
```

Set it to `true` immediately before BOTH navigations into a debate:

In the `joinDebateQueue(...).then(...)` callback, in the `if (matched)` branch:

```ts
if (matched) {
  matchedRef.current = true;
  router.replace(`/debate/${debateId}?side=${side}`);
}
```

In the realtime match `useEffect`, in the `if (updated.status === "active")` branch:

```ts
if (updated.status === "active") {
  matchedRef.current = true;
  router.replace(`/debate/${debate.id}?side=${side}`);
}
```

- [ ] **Step 3: Add the heartbeat + cleanup effect**

Add this `useEffect` after the existing realtime match effect (it depends on `debate`):

```tsx
useEffect(() => {
  if (!debate || debate.status !== "waiting") return;

  const ping = () => { heartbeatQueue(debate.id); };
  ping(); // immediate, so a slow first interval doesn't let us look stale
  const interval = setInterval(ping, 10_000);

  // Best-effort cancel if the user backgrounds or closes the tab while waiting.
  const onHidden = () => {
    if (document.visibilityState === "hidden" && !matchedRef.current) {
      cancelQueue(debate.id);
    }
  };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", onHidden);

  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", onHidden);
    // Unmount while still waiting and not matched => leaving the queue.
    if (!matchedRef.current) cancelQueue(debate.id);
  };
}, [debate]);
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx next lint --file app/debate/queue/page.tsx`
Expected: no type errors; no new lint errors. (If `tsc` is slow, `npx tsc --noEmit` over the whole project is still the reliable check.)

- [ ] **Step 5: Manual verification (two browser sessions)**

With the app running (`npm run dev`) and two signed-in accounts:
1. Account 1 joins a question on side A → lands in the queue.
2. Account 1 **closes the tab**. Wait ~35s.
3. Account 2 joins the same question on side B → should NOT match the ghost; should create/keep its own waiting row. Confirm via the "waiting to debate" count reflecting only the live waiter.
4. Now with both tabs open: Account 1 (side A) waits, Account 2 (side B) joins → both route into `/debate/<id>` and can chat. Confirm Account 1's tab navigated in (proves heartbeat kept it matchable and the realtime UPDATE fired).
5. Confirm leaving the queue page (back button) drops the waiting count within 30s.

- [ ] **Step 6: Commit**

```bash
git add app/debate/queue/page.tsx
git commit -m "feat: queue page heartbeats while waiting + cancels on leave"
```

---

## Self-Review

**Spec coverage:**
- §1 Schema → Task 1. ✓
- §2 `heartbeatQueue` → Task 2. ✓
- §3 Queue page (interval, cancel on unmount + pagehide/visibilitychange, matchedRef guard) → Task 4. ✓
- §4 Matchmaker freshness predicate → Task 1 (same migration). ✓
- §5 `getQueueCounts` freshness → Task 3. ✓
- Testing section (heartbeat authz/no-op/non-participant; matchmaker freshness via RPC; getQueueCounts window) → Task 2 tests, Task 1 Step 3 verification, Task 3 test. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. ✓

**Type/name consistency:** `heartbeatQueue(debateId: string)`, `heartbeatSchema`, `last_seen_at`, `matchedRef`, 30s window (`now() - interval '30 seconds'` in SQL; `Date.now() - 30_000` in JS) used identically across tasks. ✓

**Note on the matchmaker freshness test:** verified via SQL/RPC against the live DB rather than a Vitest unit test, since `join_debate` is plpgsql (no JS test harness for it in this repo). Captured as Task 1 Step 3 + Task 4 Step 5 manual two-session test.
