# Auth & Backend Redesign — Phase 5: Rate Limiting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Add a lightweight Postgres-based rate limiter and apply it to the abusable write actions, so a single user can't flood comments, debate messages, community submissions, friend requests, or predictions.

**Architecture:** A `rate_limits` table + an atomic `check_rate_limit(user_id, action, limit, window_seconds)` SECURITY DEFINER function (fixed-window counter, increment-and-return in one statement). A `checkRateLimit` server helper calls it as the third step of the action pattern (after `requireAccount`, before the write) and throws `ActionError("rate_limited", …)` when exceeded. The helper fails **open** if the function isn't installed yet (so the app keeps working before migration 007 is applied).

**Tech Stack:** Supabase Postgres (plpgsql), Next.js server actions, Vitest.

## Global Constraints

- `@/*` → repo root. Server-only: `import "server-only";`. Action files keep `"use server";`.
- Rate limit is enforced AFTER `requireAccount()` (so limits are per real-account user id) and BEFORE the write.
- Migration written, not applied by implementer. `check_rate_limit` is `SECURITY DEFINER`.
- Helper fails open only on the specific "function does not exist" error (Postgres `42883`); any other rpc error propagates.
- Tests hermetic (mock `@/lib/server/supabase`). Commit per task with exact message; stage only listed files; never `git add -A`.

## File Structure (Phase 5)

- Create `supabase/migrations/007_rate_limits.sql` — `rate_limits` table + `check_rate_limit` function.
- Modify `supabase/schema.sql` — add the table + function + RLS (no client policies; service-role only).
- Create `lib/server/ratelimit.ts` — `checkRateLimit(...)`.
- Create `lib/server/ratelimit.test.ts`.
- Modify `lib/server/comments.ts`, `lib/server/debates.ts`, `lib/server/community.ts`, `lib/server/social.ts` — call `checkRateLimit` in the abusable actions; update tests.

---

### Task 1: Rate-limit migration

**Files:** Create `supabase/migrations/007_rate_limits.sql`; Modify `supabase/schema.sql`.

**Interfaces:** `check_rate_limit(p_user_id uuid, p_action text, p_limit int, p_window_seconds int) returns boolean` — increments the current window's counter and returns `true` if the request is allowed (count ≤ limit), `false` if over.

- [ ] **Step 1: Write `supabase/migrations/007_rate_limits.sql`**
```sql
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
```

- [ ] **Step 2: (Controller) apply migration 007.** Implementer notes it pending.

- [ ] **Step 3: Sync `supabase/schema.sql`** — add the `rate_limits` table, the `enable row level security` line (no client policies), and the `check_rate_limit` function alongside the other functions.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/007_rate_limits.sql supabase/schema.sql
git commit -m "feat: add rate_limits table and atomic check_rate_limit function"
```

---

### Task 2: `checkRateLimit` helper

**Files:** Create `lib/server/ratelimit.ts`, `lib/server/ratelimit.test.ts`.

**Interfaces:** `checkRateLimit(userId: string, action: string, limit: number, windowSeconds: number): Promise<void>` (from `@/lib/server/ratelimit`) — calls the rpc; throws `ActionError("rate_limited", …)` when the rpc returns `false`; throws on a real rpc error; returns normally (fails open) when the function is missing (error code `42883`).

- [ ] **Step 1: Write the failing test** `lib/server/ratelimit.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/server/supabase", () => ({ createServiceSupabase: () => ({ rpc }) }));
import { checkRateLimit } from "@/lib/server/ratelimit";
import { ActionError } from "@/lib/server/result";

beforeEach(() => rpc.mockReset());

describe("checkRateLimit", () => {
  it("passes when under the limit", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(checkRateLimit("u1", "comment", 5, 60)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", { p_user_id: "u1", p_action: "comment", p_limit: 5, p_window_seconds: 60 });
  });
  it("throws rate_limited when over the limit", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(checkRateLimit("u1", "comment", 5, 60)).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("fails open when the function is not installed (42883)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } });
    await expect(checkRateLimit("u1", "comment", 5, 60)).resolves.toBeUndefined();
  });
  it("propagates other rpc errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(checkRateLimit("u1", "comment", 5, 60)).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/server/ratelimit.ts`**
```typescript
import "server-only";
import { createServiceSupabase } from "@/lib/server/supabase";
import { ActionError } from "@/lib/server/result";

// Atomic fixed-window rate limit. Throws ActionError("rate_limited") when the
// caller exceeds `limit` writes of `action` within `windowSeconds`. Fails OPEN
// if the DB function isn't installed yet (so the app works before migration 007).
export async function checkRateLimit(
  userId: string, action: string, limit: number, windowSeconds: number
): Promise<void> {
  const db = createServiceSupabase();
  const { data, error } = await db.rpc("check_rate_limit", {
    p_user_id: userId, p_action: action, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) {
    if ((error as { code?: string }).code === "42883") return; // function missing → allow
    throw error;
  }
  if (data === false) {
    throw new ActionError("rate_limited", "you're doing that too fast — give it a moment");
  }
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**
```bash
git add lib/server/ratelimit.ts lib/server/ratelimit.test.ts
git commit -m "feat: add checkRateLimit helper (fails open if function absent)"
```

---

### Task 3: Apply rate limits to the abusable actions

**Files:** Modify `lib/server/comments.ts`, `lib/server/debates.ts`, `lib/server/community.ts`, `lib/server/social.ts` + their tests.

**Limits (action key, limit, window seconds):**
- `postComment` → `("comment", 10, 60)`
- `sendDebateMessage` → `("debate_msg", 30, 60)`
- `submitCommunityQuestion` → `("community_submit", 5, 3600)`
- `sendFriendRequest` → `("friend_req", 20, 3600)`
- `makePrediction` → `("prediction", 60, 3600)`

(Leave `likeComment`, debate join/end/flag/cancel, and `respondToFriendRequest` unlimited for now.)

- [ ] **Step 1: Wire the limiter into each action**
In each of the five actions above, immediately AFTER `const user = await requireAccount();` and BEFORE the write, add:
```typescript
await checkRateLimit(user.id, "<action key>", <limit>, <window>);
```
using the values from the table. Add `import { checkRateLimit } from "@/lib/server/ratelimit";` to each module.

- [ ] **Step 2: Update tests**
In `comments.test.ts`, `debates.test.ts`, `community.test.ts`, `social.test.ts`, add `vi.mock("@/lib/server/ratelimit", () => ({ checkRateLimit: vi.fn() }))` (hoisted) so existing happy-path tests still pass (the mock resolves to undefined = allowed). Add ONE test in `comments.test.ts` (representative) asserting that when `checkRateLimit` throws `ActionError("rate_limited", …)`, `postComment` returns `{ ok: false, code: "rate_limited" }` and performs NO insert.

- [ ] **Step 3: Surface `rate_limited` in the comment UI (minimal)**
In `components/comments/CommentSection.tsx`, where `postComment`'s result is handled, if `!res.ok && res.code === "rate_limited"` show `res.error` to the user (reuse any existing error display, or a simple inline message). Other call sites may simply ignore it for now (server still enforces it).

- [ ] **Step 4: Type-check + full test run** — `npx tsc --noEmit` → 0; `npm run test:run` → all pass.

- [ ] **Step 5: Commit**
```bash
git add lib/server/comments.ts lib/server/comments.test.ts lib/server/debates.ts lib/server/debates.test.ts lib/server/community.ts lib/server/community.test.ts lib/server/social.ts lib/server/social.test.ts components/comments/CommentSection.tsx
git commit -m "feat: rate-limit comment/debate-message/community/friend/prediction actions"
```

---

## Self-Review
- **Spec coverage:** Postgres limiter (Task 1) ✓; helper with fail-open (Task 2) ✓; applied to the abusable writes + tests + minimal UI surface (Task 3) ✓.
- **Placeholder scan:** SQL + TS shown in full; per-action limits enumerated; test additions specified.
- **Type consistency:** `checkRateLimit(userId, action, limit, windowSeconds): Promise<void>`; `rate_limited` code consistent.

## Notes
- Migration 007 must be applied for limits to take effect; until then the helper fails open and the app works normally.
- Phase 6 (reports) will also call `checkRateLimit(user.id, "report", …)`.
