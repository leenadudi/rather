# Auth & Backend Redesign — Phase 6: Report-Based Moderation + Admin Server Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Add report-based moderation (community questions go live; reports can hide them pending review) and move the admin question writes to server actions — the last client-side writes — so the RLS lockdown (migration 004) can finally be applied.

**Architecture:** A `reports` table + a `questions.status` column (`approved`/`hidden`). A `reportContent` server action (account-gated + rate-limited) records a report and auto-hides a question once it crosses a threshold. Community reads exclude hidden questions. Admin question create/delete/status become server actions in `lib/server/admin.ts`; they are reachable only from the `/admin` page, which the Basic Auth middleware already gates (the action POST goes to `/admin`). The admin page gains a moderation queue for reported/hidden questions.

**Tech Stack:** Supabase Postgres, Next.js server actions, Vitest.

## Global Constraints

- `@/*` → repo root. Server-only: `import "server-only";`. Action files: `"use server";`.
- `reportContent` uses `requireAccount` + `checkRateLimit(user.id, "report", 10, 3600)`.
- Admin actions rely on the existing `/admin` Basic Auth middleware gate (their POST routes through `/admin`). Document this; do not add a second auth mechanism.
- Migrations written, not applied by implementer. After Phase 6, ALL writes are server-side → migration 004 (RLS lockdown) becomes safe to apply (note in checklist).
- Tests hermetic. Commit per task with exact message; stage only listed files; never `git add -A`.

## File Structure (Phase 6)

- Create `supabase/migrations/008_reports.sql` — `reports` table + `questions.status` + RLS.
- Modify `supabase/schema.sql`.
- Create `lib/server/moderation.ts` — `"use server"`; `reportContent(...)`.
- Create `lib/server/admin.ts` — `"use server"`; `adminCreateQuestion(...)`, `adminDeleteQuestion(...)`, `adminSetQuestionStatus(...)`.
- Create tests for both.
- Modify `lib/community.ts` — exclude `status = 'hidden'` from feed + detail reads; add `getReportedQuestions()` read for the admin queue.
- Modify `app/admin/page.tsx` — use the admin actions; add a moderation queue section.
- Add `reportSchema` to `lib/server/validation.ts`.

---

### Task 1: Reports migration

**Files:** Create `supabase/migrations/008_reports.sql`; Modify `supabase/schema.sql`.

**Interfaces:** `reports(id, reporter_id, target_type, target_id, reason, created_at)` with `unique(reporter_id, target_type, target_id)`; `questions.status text not null default 'approved'`.

- [ ] **Step 1: Write `supabase/migrations/008_reports.sql`**
```sql
-- Phase 6: report-based moderation.
alter table questions add column if not exists status text not null default 'approved'
  check (status in ('approved', 'hidden'));

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete set null,
  target_type text not null check (target_type in ('question', 'comment')),
  target_id uuid not null,
  reason text,
  created_at timestamptz default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_target_idx on reports (target_type, target_id);

alter table reports enable row level security;
-- Browser may read only its own reports; all writes go through the service role.
create policy "read own reports" on reports for select using (auth.uid() = reporter_id);
```

- [ ] **Step 2: (Controller) apply migration 008.** Note pending.

- [ ] **Step 3: Sync `supabase/schema.sql`** — add `status` to the `questions` table, the `reports` table, its index, `enable row level security`, and the `read own reports` policy.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/008_reports.sql supabase/schema.sql
git commit -m "feat: add reports table and questions.status for moderation"
```

---

### Task 2: `reportContent` action + hide-on-threshold + feed filtering

**Files:** Create `lib/server/moderation.ts`, `lib/server/moderation.test.ts`; Modify `lib/server/validation.ts`, `lib/community.ts`.

**Interfaces:**
- `reportContent(targetType: "question"|"comment", targetId: string, reason?: string): Promise<ActionResult<null>>` — `requireAccount` + `checkRateLimit(user.id, "report", 10, 3600)`, insert a report (ignore duplicate from same user), then if the target is a `question` and its report count ≥ `HIDE_THRESHOLD` (3), set `questions.status = 'hidden'`.
- `getReportedQuestions(): Promise<Question[]>` (in `lib/community.ts`) — hidden community questions for the admin queue.
- `getCommunityFeed` / `getCommunityQuestion` exclude `status = 'hidden'`.

- [ ] **Step 1: Add `reportSchema` to `lib/server/validation.ts`**
```typescript
export const reportSchema = z.object({
  targetType: z.enum(["question", "comment"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
```

- [ ] **Step 2: Write the failing test** `lib/server/moderation.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
const { requireAccount } = vi.hoisted(() => ({ requireAccount: vi.fn() }));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { reportInsert, updateStatus, reportCount } = vi.hoisted(() => ({ reportInsert: vi.fn(), updateStatus: vi.fn(), reportCount: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/ratelimit", () => ({ checkRateLimit }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (t: string) => t === "reports"
      ? { insert: (r: unknown) => { reportInsert(r); return { error: null }; },
          select: () => ({ eq: () => ({ eq: () => ({ then: (res: (v: { count: number }) => void) => res({ count: reportCount() }) }) }) }) }
      : { update: (u: unknown) => { updateStatus(u); return { eq: () => ({ error: null }) }; } },
  }),
}));
import { reportContent } from "@/lib/server/moderation";
beforeEach(() => { [requireAccount, checkRateLimit, reportInsert, updateStatus, reportCount].forEach(m => m.mockReset()); requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false }); reportCount.mockReturnValue(1); });

describe("reportContent", () => {
  it("rejects an invalid target id without writing", async () => {
    const r = await reportContent("question", "nope");
    expect(r.ok).toBe(false);
    expect(reportInsert).not.toHaveBeenCalled();
  });
  it("records a report and does not hide below threshold", async () => {
    reportCount.mockReturnValue(1);
    const r = await reportContent("question", "11111111-1111-1111-1111-111111111111", "spam");
    expect(reportInsert).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: "u1", target_type: "question" }));
    expect(updateStatus).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
  it("hides the question at/above the threshold", async () => {
    reportCount.mockReturnValue(3);
    await reportContent("question", "11111111-1111-1111-1111-111111111111");
    expect(updateStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "hidden" }));
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement `lib/server/moderation.ts`**
```typescript
"use server";

import { requireAccount } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import type { ActionResult } from "@/lib/server/result";
import { parseOrThrow, reportSchema } from "@/lib/server/validation";

const HIDE_THRESHOLD = 3;

export async function reportContent(
  targetType: "question" | "comment", targetId: string, reason?: string
): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(reportSchema, { targetType, targetId, reason });
    const user = await requireAccount();
    await checkRateLimit(user.id, "report", 10, 3600);
    const db = createServiceSupabase();

    await db.from("reports").insert({
      reporter_id: user.id,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason ?? null,
    });

    if (input.targetType === "question") {
      const { count } = await db
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "question")
        .eq("target_id", input.targetId);
      if ((count ?? 0) >= HIDE_THRESHOLD) {
        await db.from("questions").update({ status: "hidden" }).eq("id", input.targetId);
      }
    }
    return null;
  });
}
```
> Note: the `reports` insert may hit the `unique(reporter_id, target_type, target_id)` constraint for a duplicate report; that's acceptable — wrap is via `run`, returning a sanitized fail. If you prefer silent idempotency, add `.select()`-less `upsert(..., { onConflict: "reporter_id,target_type,target_id", ignoreDuplicates: true })` instead of `insert`. Use `upsert` with `ignoreDuplicates` so a repeat report is a no-op rather than an error.

- [ ] **Step 5: Use `upsert` for idempotency** — change the `insert` above to:
```typescript
await db.from("reports").upsert(
  { reporter_id: user.id, target_type: input.targetType, target_id: input.targetId, reason: input.reason ?? null },
  { onConflict: "reporter_id,target_type,target_id", ignoreDuplicates: true }
);
```
(Adjust the test's `reportInsert` mock to also accept being called as `upsert` — name the spy on whichever method the final code uses; keep the assertion that it's called with the report row.)

- [ ] **Step 6: Filter hidden questions in `lib/community.ts`** — in `getCommunityFeed` and `getCommunityQuestion`, add `.neq("status", "hidden")` to the `questions` query. Add:
```typescript
export async function getReportedQuestions(): Promise<Question[]> {
  const { data } = await supabase.from("questions").select("*").eq("status", "hidden").order("created_at", { ascending: false });
  return (data ?? []) as Question[];
}
```

- [ ] **Step 7: Run — expect PASS; `npx tsc --noEmit` → 0.**

- [ ] **Step 8: Commit**
```bash
git add lib/server/moderation.ts lib/server/moderation.test.ts lib/server/validation.ts lib/community.ts
git commit -m "feat: reportContent action with hide-on-threshold; filter hidden community questions"
```

---

### Task 3: Admin question server actions + moderation queue UI

**Files:** Create `lib/server/admin.ts`, `lib/server/admin.test.ts`; Modify `app/admin/page.tsx`.

**Interfaces (from `@/lib/server/admin`):**
- `adminCreateQuestion(input: { optionA: string; optionB: string; dimension: string | null; debateEnabled: boolean; publishedAt: string }): Promise<ActionResult<{ id: string }>>`
- `adminDeleteQuestion(id: string): Promise<ActionResult<null>>`
- `adminSetQuestionStatus(id: string, status: "approved" | "hidden"): Promise<ActionResult<null>>`

> These are gated by the `/admin` Basic Auth middleware (their POST routes through `/admin`). They use the service-role client. They do NOT call `requireAccount` (admin is not a Supabase account).

- [ ] **Step 1: Write the failing test** `lib/server/admin.test.ts` — mock `@/lib/server/supabase`; assert `adminCreateQuestion` inserts `{ option_a, option_b, type: "daily", ... }` and returns the id; `adminSetQuestionStatus` validates the status enum and updates; `adminDeleteQuestion` deletes by id. (Use the same mock-shape pattern as other action tests.)

- [ ] **Step 2: Implement `lib/server/admin.ts`**
```typescript
"use server";

import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";

export async function adminCreateQuestion(input: {
  optionA: string; optionB: string; dimension: string | null; debateEnabled: boolean; publishedAt: string;
}): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    if (!input.optionA?.trim() || !input.optionB?.trim()) throw new ActionError("invalid_input", "both options are required");
    const db = createServiceSupabase();
    const { data, error } = await db.from("questions").insert({
      option_a: input.optionA.trim(),
      option_b: input.optionB.trim(),
      dimension: input.dimension,
      debate_enabled: input.debateEnabled,
      published_at: input.publishedAt,
      type: "daily",
    }).select().single();
    if (error) throw error;
    return { id: (data as { id: string }).id };
  });
}

export async function adminDeleteQuestion(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const db = createServiceSupabase();
    const { error } = await db.from("questions").delete().eq("id", id);
    if (error) throw error;
    return null;
  });
}

export async function adminSetQuestionStatus(id: string, status: "approved" | "hidden"): Promise<ActionResult<null>> {
  return run(async () => {
    if (status !== "approved" && status !== "hidden") throw new ActionError("invalid_input", "bad status");
    const db = createServiceSupabase();
    const { error } = await db.from("questions").update({ status }).eq("id", id);
    if (error) throw error;
    return null;
  });
}
```

- [ ] **Step 3: Run — expect PASS.**

- [ ] **Step 4: Rewrite `app/admin/page.tsx` writes to use the actions** — read the file; replace the direct `supabase.from("questions").insert(...)` (handlePost) with `adminCreateQuestion({...})` and the `supabase.from("questions").delete()` (handleKill) with `adminDeleteQuestion(id)`, adapting to `ActionResult`. Keep reads (`loadQuestions`, live counts) as direct client reads. Add a **moderation queue** section: load `getReportedQuestions()` and render each hidden question with "restore" (`adminSetQuestionStatus(id, "approved")`) and "delete" (`adminDeleteQuestion(id)`) buttons; refresh the list after an action.

- [ ] **Step 5: Type-check + full test run** — `npx tsc --noEmit` → 0; `npm run test:run` → all pass.

- [ ] **Step 6: Commit**
```bash
git add lib/server/admin.ts lib/server/admin.test.ts app/admin/page.tsx
git commit -m "feat: admin question server actions + moderation queue; removes last client writes"
```

---

## Self-Review
- **Spec coverage:** reports table + status (Task 1) ✓; reportContent + hide-on-threshold + feed filtering (Task 2) ✓; admin question CRUD as server actions + moderation queue (Task 3) ✓; last client writes removed → 004 now applicable ✓.
- **Placeholder scan:** SQL + action code shown in full; admin UI rewrite described against the real file; test shapes specified.
- **Type consistency:** `reportContent`/admin action signatures + `ActionResult` consistent; `status` enum consistent across migration, actions, and reads.

## Notes / final checklist additions
- After Phase 6, the only client-side writes left should be none (verify with a grep). Then migration `004_rls_lockdown.sql` is safe to apply.
- Wire a "report" button into the community question UI in a later UX pass (the `reportContent` action is ready); not required for this phase.
- `flagDebateMessage` (Phase 4 note) can now share the moderation surface if desired.
