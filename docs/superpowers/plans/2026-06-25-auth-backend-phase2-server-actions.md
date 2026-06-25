# Auth & Backend Redesign — Phase 2: Writes → Server Actions + RLS Lockdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move every database write out of the browser into Next.js Server Actions that derive the user server-side, validate input, and write with the service-role client — then lock RLS so the browser can only read.

**Architecture:** Builds on Phase 1's `lib/server/` foundation (`createServiceSupabase`, `getSessionUser`/`ensureAnonUser`/`requireAccount`, `ActionResult`/`ok`/`fail`/`resultFromError`). Each write becomes an `async` server action in a `"use server"` file under `lib/server/`, wrapped by a small `run()` helper that returns `ActionResult`. Read helpers stay client-side in `lib/`. After all writes are server-side, a migration removes every client write policy (browser anon key becomes SELECT-only).

**Tech Stack:** Next.js 14.2.35 App Router server actions, `@supabase/ssr`, `@supabase/supabase-js`, zod (added here), Vitest.

## Global Constraints

- Import alias `@/*` → repo root.
- Server-only modules begin with `import "server-only";`. Server-action files begin with `"use server";` (a directive string literal as the first statement) and export only `async` functions.
- Actions derive the caller's id **server-side** via `ensureAnonUser()` — never accept a `userId`/`fromId`/`predictorId` argument from the client.
- **Account-required gating is NOT applied in this phase.** All actions use `ensureAnonUser()` so anonymous users keep current access. Phase 4 swaps the comment/debate/community/social actions to `requireAccount()` once real accounts exist. Do not call `requireAccount()` in this phase.
- Every action returns `ActionResult<T>` (`{ ok: true; data } | { ok: false; error; code? }`). Never throw across the action boundary — wrap with `run()`.
- Tests are hermetic: mock `@/lib/server/supabase`, `@/lib/server/auth`, and `@/lib/server/validation` as needed. No network.
- The service-role client (`createServiceSupabase`) is server-only and bypasses RLS — only it performs writes.
- Commit after each task with the exact message shown. Stage only the files listed (the tree is clean as of baseline `a123049`, so `git add <paths>` is safe; still never use `git add -A`).

---

## File Structure (Phase 2)

- Create `lib/server/run.ts` — `run(fn)` wrapper returning `ActionResult`.
- Create `lib/server/validation.ts` — zod schemas + `parseOrThrow` helper.
- Create `lib/server/votes.ts` — `"use server"`; `castVote`.
- Create `lib/server/comments.ts` — `"use server"`; `postComment`, `likeComment`.
- Create `lib/server/debates.ts` — `"use server"`; `joinDebateQueue`, `sendDebateMessage`, `endDebate`, `flagDebateMessage`, `cancelQueue`.
- Create `lib/server/community.ts` — `"use server"`; `submitCommunityQuestion`.
- Create `lib/server/social.ts` — `"use server"`; `sendFriendRequest`, `respondToFriendRequest`, `makePrediction`.
- Create matching `*.test.ts` for `run`, `validation`, and each domain.
- Modify `lib/votes.ts`, `lib/comments.ts`, `lib/debates.ts`, `lib/community.ts`, `lib/friends.ts`, `lib/predictions.ts` — remove the write functions (keep read helpers).
- Modify call sites: `app/page.tsx`, `app/explore/[id]/page.tsx`, `components/community/CommunityCard.tsx`, `components/community/SubmitModal.tsx`, `components/comments/CommentSection.tsx`, `app/debate/queue/page.tsx`, `components/debate/DebateChat.tsx`, `app/(main)/friends/page.tsx`, `app/onboarding/friends/page.tsx`, `components/sidebar/GroupSidebar.tsx`.
- Create `supabase/migrations/004_rls_lockdown.sql`.
- Modify `lib/supabase.ts` (delete unused `createServiceClient`), retire `lib/anon.ts` usage.

---

### Task 1: `run()` wrapper + zod validation schemas

**Files:**
- Create: `lib/server/run.ts`, `lib/server/run.test.ts`
- Create: `lib/server/validation.ts`, `lib/server/validation.test.ts`
- Modify: `package.json` (add `zod`)

**Interfaces:**
- Produces: `run<T>(fn: () => Promise<T>): Promise<ActionResult<T>>` (from `@/lib/server/run`).
- Produces (from `@/lib/server/validation`): zod schemas `voteSchema`, `commentSchema`, `likeSchema`, `joinDebateSchema`, `debateMessageSchema`, `communitySubmitSchema`, `friendRequestSchema`, `respondRequestSchema`, `predictionSchema`; and `parseOrThrow<T>(schema, input): T` that throws `ActionError("invalid_input", <first issue message>)` on failure.

- [ ] **Step 1: Install zod**

Run: `npm install zod@^3`
Expected: `zod` in `dependencies`.

- [ ] **Step 2: Write the failing test for `run()`**

Create `lib/server/run.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { run } from "@/lib/server/run";
import { ActionError } from "@/lib/server/result";

describe("run", () => {
  it("wraps a successful result in ok()", async () => {
    expect(await run(async () => 42)).toEqual({ ok: true, data: 42 });
  });
  it("maps a thrown ActionError to fail() with its code", async () => {
    const r = await run(async () => { throw new ActionError("bad", "nope"); });
    expect(r).toEqual({ ok: false, error: "nope", code: "bad" });
  });
  it("hides unknown errors", async () => {
    const r = await run(async () => { throw new Error("secret"); });
    expect(r).toEqual({ ok: false, error: "something went wrong", code: "internal" });
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`npm run test:run -- lib/server/run.test.ts`), "cannot find module".

- [ ] **Step 4: Implement `lib/server/run.ts`**

```typescript
import { ActionResult, ok, resultFromError } from "@/lib/server/result";

// Wraps an action body: returns ok(data) on success, or a sanitized fail() on throw.
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return resultFromError(e);
  }
}
```

- [ ] **Step 5: Run it — expect PASS.**

- [ ] **Step 6: Write the failing test for validation**

Create `lib/server/validation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseOrThrow, voteSchema, commentSchema, communitySubmitSchema } from "@/lib/server/validation";
import { ActionError } from "@/lib/server/result";

describe("validation", () => {
  it("accepts a valid vote", () => {
    expect(parseOrThrow(voteSchema, { questionId: "11111111-1111-1111-1111-111111111111", choice: "A" }))
      .toEqual({ questionId: "11111111-1111-1111-1111-111111111111", choice: "A" });
  });
  it("rejects a bad choice with invalid_input", () => {
    expect(() => parseOrThrow(voteSchema, { questionId: "11111111-1111-1111-1111-111111111111", choice: "C" }))
      .toThrowError(expect.objectContaining({ code: "invalid_input" }));
  });
  it("rejects an empty comment", () => {
    expect(() => parseOrThrow(commentSchema, { questionId: "11111111-1111-1111-1111-111111111111", content: "", choice: "A" }))
      .toThrow(ActionError);
  });
  it("rejects an over-long comment", () => {
    const long = "x".repeat(2001);
    expect(() => parseOrThrow(commentSchema, { questionId: "11111111-1111-1111-1111-111111111111", content: long, choice: "A" }))
      .toThrow(ActionError);
  });
  it("trims and accepts community options", () => {
    const r = parseOrThrow(communitySubmitSchema, { optionA: "  cats  ", optionB: "dogs" });
    expect(r).toEqual({ optionA: "cats", optionB: "dogs" });
  });
});
```

- [ ] **Step 7: Run it — expect FAIL.**

- [ ] **Step 8: Implement `lib/server/validation.ts`**

```typescript
import { z } from "zod";
import { ActionError } from "@/lib/server/result";

const uuid = z.string().uuid();
const choice = z.enum(["A", "B"]);

export const voteSchema = z.object({ questionId: uuid, choice });
export const commentSchema = z.object({
  questionId: uuid,
  content: z.string().trim().min(1).max(2000),
  choice,
  parentId: uuid.optional(),
});
export const likeSchema = z.object({ commentId: uuid });
export const joinDebateSchema = z.object({ questionId: uuid, side: choice });
export const debateMessageSchema = z.object({ debateId: uuid, content: z.string().trim().min(1).max(1000) });
export const communitySubmitSchema = z.object({
  optionA: z.string().trim().min(2).max(120),
  optionB: z.string().trim().min(2).max(120),
});
export const friendRequestSchema = z.object({ toId: uuid });
export const respondRequestSchema = z.object({ requestId: uuid, accept: z.boolean() });
export const predictionSchema = z.object({ targetId: uuid, questionId: uuid, choice });

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ActionError("invalid_input", first?.message ?? "invalid input");
  }
  return result.data;
}
```

- [ ] **Step 9: Run both test files — expect PASS** (`npm run test:run -- lib/server/run.test.ts lib/server/validation.test.ts`).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json lib/server/run.ts lib/server/run.test.ts lib/server/validation.ts lib/server/validation.test.ts
git commit -m "feat: add run() action wrapper and zod validation schemas"
```

---

### Task 2: Vote server action + call-site swaps

**Files:**
- Create: `lib/server/votes.ts`, `lib/server/votes.test.ts`
- Modify: `lib/votes.ts` (remove `castVote`, keep `getMyVote`/`getVoteCounts`)
- Modify call sites: `app/page.tsx`, `app/explore/[id]/page.tsx`, `components/community/CommunityCard.tsx`

**Interfaces:**
- Consumes: `ensureAnonUser` (`@/lib/server/auth`), `createServiceSupabase` (`@/lib/server/supabase`), `run` (`@/lib/server/run`), `parseOrThrow`/`voteSchema` (`@/lib/server/validation`).
- Produces: `castVote(questionId: string, choice: "A"|"B"): Promise<ActionResult<{ a: number; b: number; total: number; pct_a: number; pct_b: number }>>` (from `@/lib/server/votes`). Note: **no `userId` parameter** — derived server-side. Returns fresh vote counts as `data`.

- [ ] **Step 1: Write the failing test**

Create `lib/server/votes.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureAnonUser = vi.fn();
const upsert = vi.fn();
const selectEq = vi.fn();
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: () => ({
      upsert: (...a: unknown[]) => { upsert(...a); return { select: () => ({ single: async () => ({ data: {}, error: null }) }) }; },
      select: () => ({ eq: (...a: unknown[]) => { selectEq(...a); return { then: undefined, data: [{ choice: "A" }, { choice: "B" }, { choice: "A" }] }; } }),
    }),
  }),
}));

import { castVote } from "@/lib/server/votes";

beforeEach(() => { ensureAnonUser.mockReset(); upsert.mockReset(); selectEq.mockReset(); ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: true }); });

describe("castVote", () => {
  it("rejects an invalid choice without writing", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "C" as "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_input");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects a non-uuid question id", async () => {
    const r = await castVote("nope", "A");
    expect(r.ok).toBe(false);
  });
  it("derives the user server-side and returns counts on success", async () => {
    const r = await castVote("11111111-1111-1111-1111-111111111111", "A");
    expect(ensureAnonUser).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalled();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.total).toBe(3);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `lib/server/votes.ts`**

Port the upsert + count logic from the existing `lib/votes.ts` (`castVote` + `getVoteCounts`), changing it to: derive the user via `ensureAnonUser()`, validate input, write with the service client, then compute and return counts.

```typescript
"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, voteSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";
import type { VoteCounts } from "@/types";

export async function castVote(questionId: string, choice: "A" | "B"): Promise<ActionResult<VoteCounts>> {
  return run(async () => {
    const input = parseOrThrow(voteSchema, { questionId, choice });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();

    await db
      .from("votes")
      .upsert(
        { question_id: input.questionId, choice: input.choice, user_id: user.id },
        { onConflict: "question_id,user_id", ignoreDuplicates: true }
      );

    const { data } = await db.from("votes").select("choice").eq("question_id", input.questionId);
    let a = 0, b = 0;
    for (const row of data ?? []) { if (row.choice === "A") a++; else b++; }
    const total = a + b;
    return {
      a, b, total,
      pct_a: total === 0 ? 50 : Math.round((a / total) * 100),
      pct_b: total === 0 ? 50 : Math.round((b / total) * 100),
    };
  });
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Remove `castVote` from `lib/votes.ts`**

Delete the `castVote` function from `lib/votes.ts` (lines 4–22 of the current file). Keep `getMyVote` and `getVoteCounts` unchanged.

- [ ] **Step 6: Swap call site — `app/page.tsx`**

- Change the import on line 7 from `import { castVote, getMyVote, getVoteCounts } from "@/lib/votes";` to:
  ```typescript
  import { getMyVote, getVoteCounts } from "@/lib/votes";
  import { castVote } from "@/lib/server/votes";
  ```
- The handler currently does `const { error } = await castVote(question.id, choice, userId);` (lines ~144 and ~160). Replace each with:
  ```typescript
  const res = await castVote(question.id, choice);
  if (!res.ok) {
    setSaveError(true);
    setSaving(null);
  } else {
    setSaving(null);
    setPendingChoice(null);
    setCounts(res.data);
  }
  ```
  (For the retry handler at ~160 use `pendingChoice` in place of `choice`.) Remove the now-redundant follow-up `getVoteCounts` call in those success branches, since `res.data` already carries fresh counts. Leave the realtime subscription as-is.

- [ ] **Step 7: Swap call site — `app/explore/[id]/page.tsx`**

- Change line 8 import to import `castVote` from `@/lib/server/votes` and keep `getVoteCounts` from `@/lib/votes`.
- Replace `const { error } = await castVote(q.id, choice, userId);` (line ~40) with:
  ```typescript
  const res = await castVote(q.id, choice);
  if (!res.ok) { /* keep existing error handling path */ }
  else { setCounts(res.data); /* keep existing post-vote state updates */ }
  ```

- [ ] **Step 8: Swap call site — `components/community/CommunityCard.tsx`**

- Change line 6 import to import `castVote` from `@/lib/server/votes`, keep `getVoteCounts` from `@/lib/votes`.
- Replace `const { error } = await castVote(question.id, choice, userId);` (line ~44) with the `const res = await castVote(question.id, choice);` pattern, using `res.ok`/`res.data` like Step 7.

- [ ] **Step 9: Type-check and verify**

Run: `npx tsc --noEmit` → exit 0.
With the dev server running, load `/`, vote, confirm results render and the count updates.

- [ ] **Step 10: Commit**

```bash
git add lib/server/votes.ts lib/server/votes.test.ts lib/votes.ts app/page.tsx app/explore/[id]/page.tsx components/community/CommunityCard.tsx
git commit -m "feat: move castVote to a server action; derive user server-side"
```

---

### Task 3: Comment server actions + call-site swaps

**Files:**
- Create: `lib/server/comments.ts`, `lib/server/comments.test.ts`
- Modify: `lib/comments.ts` (remove `postComment`, `likeComment`; keep reads + `CommentSort`/`CommentFilter` types)
- Modify call site: `components/comments/CommentSection.tsx`

**Interfaces:**
- Produces (from `@/lib/server/comments`):
  - `postComment(questionId: string, content: string, choice: "A"|"B", parentId?: string): Promise<ActionResult<Comment>>` — no `userId` param.
  - `likeComment(commentId: string): Promise<ActionResult<null>>` — no `userId` param.

- [ ] **Step 1: Write the failing test**

Create `lib/server/comments.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureAnonUser = vi.fn();
const insert = vi.fn();
const likeInsert = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        if (table === "comment_likes") { likeInsert(row); return { error: null }; }
        insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }) };
      },
    }),
    rpc: (...a: unknown[]) => { rpc(...a); return Promise.resolve({ error: null }); },
  }),
}));

import { postComment, likeComment } from "@/lib/server/comments";

beforeEach(() => { [ensureAnonUser, insert, likeInsert, rpc].forEach((m) => m.mockReset()); ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: false }); });

describe("postComment", () => {
  it("rejects empty content without writing", async () => {
    const r = await postComment("11111111-1111-1111-1111-111111111111", "   ", "A");
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
  it("writes a valid comment with the server-derived user", async () => {
    const r = await postComment("11111111-1111-1111-1111-111111111111", "hi", "A");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ content: "hi", user_id: "u1", choice: "A" }));
    expect(r.ok).toBe(true);
  });
});

describe("likeComment", () => {
  it("inserts a like row and increments via rpc", async () => {
    const r = await likeComment("22222222-2222-2222-2222-222222222222");
    expect(likeInsert).toHaveBeenCalledWith(expect.objectContaining({ comment_id: "22222222-2222-2222-2222-222222222222", user_id: "u1" }));
    expect(rpc).toHaveBeenCalledWith("increment_comment_likes", { cid: "22222222-2222-2222-2222-222222222222" });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `lib/server/comments.ts`**

Port from the existing `lib/comments.ts` (`postComment`, `likeComment`), deriving the user via `ensureAnonUser()`, validating, and writing with the service client.

```typescript
"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, commentSchema, likeSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";
import type { Comment } from "@/types";

export async function postComment(
  questionId: string,
  content: string,
  choice: "A" | "B",
  parentId?: string
): Promise<ActionResult<Comment>> {
  return run(async () => {
    const input = parseOrThrow(commentSchema, { questionId, content, choice, parentId });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const { data, error } = await db
      .from("comments")
      .insert({
        question_id: input.questionId,
        content: input.content,
        choice: input.choice,
        user_id: user.id,
        parent_id: input.parentId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Comment;
  });
}

export async function likeComment(commentId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(likeSchema, { commentId });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    await db.from("comment_likes").insert({ comment_id: input.commentId, user_id: user.id });
    await db.rpc("increment_comment_likes", { cid: input.commentId });
    return null;
  });
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Remove writes from `lib/comments.ts`**

Delete `postComment` and `likeComment` from `lib/comments.ts`. Keep `getComments`, `getReplies`, `getCommentCount`, and the `CommentSort`/`CommentFilter` type exports.

- [ ] **Step 6: Swap call site — `components/comments/CommentSection.tsx`**

- Change the import on line 5 to keep reads + types from `@/lib/comments` and import the writes from `@/lib/server/comments`:
  ```typescript
  import { getComments, getReplies, type CommentSort, type CommentFilter } from "@/lib/comments";
  import { postComment, likeComment } from "@/lib/server/comments";
  ```
- Replace the two `postComment(...)` calls (lines ~41 and ~63): drop the trailing `userId` argument and adapt to the result shape, e.g.:
  ```typescript
  const res = await postComment(questionId, content, myChoice);          // line ~41
  const created = res.ok ? res.data : null;
  ```
  ```typescript
  const res = await postComment(questionId, content, myChoice, parentId); // line ~63
  const created = res.ok ? res.data : null;
  ```
  Keep the rest of the logic that uses `created` unchanged (it already handles a possibly-null result).
- Replace `await likeComment(commentId, userId);` (line ~48) with `await likeComment(commentId);`.

- [ ] **Step 7: Type-check + verify** — `npx tsc --noEmit` → 0; vote on `/`, post a comment + like, confirm both work.

- [ ] **Step 8: Commit**

```bash
git add lib/server/comments.ts lib/server/comments.test.ts lib/comments.ts components/comments/CommentSection.tsx
git commit -m "feat: move postComment/likeComment to server actions"
```

---

### Task 4: Debate server actions + call-site swaps

**Files:**
- Create: `lib/server/debates.ts`, `lib/server/debates.test.ts`
- Modify: `lib/debates.ts` (remove `joinDebateQueue`, `sendDebateMessage`, `endDebate`, `flagDebateMessage`; keep `getQueueCounts`, `getDebateMessages`)
- Modify call sites: `app/debate/queue/page.tsx`, `components/debate/DebateChat.tsx`

**Interfaces:**
- Produces (from `@/lib/server/debates`):
  - `joinDebateQueue(questionId: string, side: "A"|"B"): Promise<ActionResult<{ debateId: string; matched: boolean }>>` — no `userId`.
  - `sendDebateMessage(debateId: string, content: string): Promise<ActionResult<null>>` — side derived server-side from the caller.
  - `endDebate(debateId: string): Promise<ActionResult<null>>`.
  - `flagDebateMessage(messageId: string, debateId: string): Promise<ActionResult<{ flagCount: number }>>`.
  - `cancelQueue(debateId: string): Promise<ActionResult<null>>`.

- [ ] **Step 1: Write the failing test**

Create `lib/server/debates.test.ts`. Cover: `joinDebateQueue` validates side and derives the user; `sendDebateMessage` rejects when the caller is not a participant of the debate; `sendDebateMessage` writes with the correct derived side when the caller matches `user_a_id`.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureAnonUser = vi.fn();
const state: { debateRow: Record<string, unknown> | null; inserted: Record<string, unknown> | null } = { debateRow: null, inserted: null };

vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ not: () => ({ limit: () => ({ single: async () => ({ data: null }) }) }) }),
          single: async () => ({ data: state.debateRow }),
        }),
      }),
      insert: (row: Record<string, unknown>) => { state.inserted = row; return { select: () => ({ single: async () => ({ data: { id: "d1" }, error: null }) }) }; },
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: "d1" }, error: null }) }) }) }),
    }),
  }),
}));

import { sendDebateMessage } from "@/lib/server/debates";

beforeEach(() => { ensureAnonUser.mockReset(); state.debateRow = null; state.inserted = null; ensureAnonUser.mockResolvedValue({ id: "ua", isAnonymous: false }); });

describe("sendDebateMessage", () => {
  it("rejects a non-participant", async () => {
    state.debateRow = { id: "d1", user_a_id: "someone", user_b_id: "other" };
    const r = await sendDebateMessage("33333333-3333-3333-3333-333333333333", "hello");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_participant");
  });
  it("sends as side A when the caller is user_a", async () => {
    state.debateRow = { id: "d1", user_a_id: "ua", user_b_id: "ub" };
    const r = await sendDebateMessage("33333333-3333-3333-3333-333333333333", "hello");
    expect(r.ok).toBe(true);
    expect(state.inserted).toMatchObject({ sender_side: "A", content: "hello" });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `lib/server/debates.ts`**

Port the matchmaking/messaging/flag logic from the existing `lib/debates.ts`, with these changes: derive the user via `ensureAnonUser()`; in `sendDebateMessage` and `endDebate`, look up the debate row and verify the caller is `user_a_id` or `user_b_id` (throw `ActionError("not_participant", ...)` otherwise), deriving `sender_side` from which one matches; `cancelQueue` updates the waiting debate's status to `'ended'` (do not hard-delete). Return shapes per the Interfaces block.

```typescript
"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, joinDebateSchema, debateMessageSchema } from "@/lib/server/validation";

export async function joinDebateQueue(questionId: string, side: "A" | "B"): Promise<ActionResult<{ debateId: string; matched: boolean }>> {
  return run(async () => {
    const input = parseOrThrow(joinDebateSchema, { questionId, side });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const opposite = input.side === "A" ? "B" : "A";
    const waitingCol = opposite === "A" ? "user_a_id" : "user_b_id";
    const myCol = input.side === "A" ? "user_a_id" : "user_b_id";

    const { data: waiting } = await db
      .from("debates").select("*")
      .eq("question_id", input.questionId).eq("status", "waiting")
      .not(waitingCol, "is", null).limit(1).single();

    if (waiting) {
      const { data: matched } = await db
        .from("debates")
        .update({ [myCol]: user.id, status: "active", started_at: new Date().toISOString() })
        .eq("id", (waiting as { id: string }).id).select().single();
      return { debateId: (matched as { id: string }).id, matched: true };
    }
    const { data: created } = await db
      .from("debates").insert({ question_id: input.questionId, [myCol]: user.id, status: "waiting" })
      .select().single();
    return { debateId: (created as { id: string }).id, matched: false };
  });
}

async function loadParticipantSide(db: ReturnType<typeof createServiceSupabase>, debateId: string, userId: string): Promise<"A" | "B"> {
  const { data } = await db.from("debates").select("user_a_id, user_b_id").eq("id", debateId).single();
  const row = data as { user_a_id: string | null; user_b_id: string | null } | null;
  if (row?.user_a_id === userId) return "A";
  if (row?.user_b_id === userId) return "B";
  throw new ActionError("not_participant", "you are not part of this debate");
}

export async function sendDebateMessage(debateId: string, content: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(debateMessageSchema, { debateId, content });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const side = await loadParticipantSide(db, input.debateId, user.id);
    await db.from("debate_messages").insert({ debate_id: input.debateId, sender_side: side, content: input.content });
    return null;
  });
}

export async function endDebate(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    await loadParticipantSide(db, debateId, user.id); // throws if not a participant
    await db.from("debates").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", debateId);
    return null;
  });
}

export async function flagDebateMessage(messageId: string, debateId: string): Promise<ActionResult<{ flagCount: number }>> {
  return run(async () => {
    await ensureAnonUser();
    const db = createServiceSupabase();
    await db.from("debate_messages").update({ flagged: true }).eq("id", messageId);
    const { data } = await db.from("debates").select("flag_count").eq("id", debateId).single();
    const newCount = ((data as { flag_count: number } | null)?.flag_count ?? 0) + 1;
    await db.from("debates").update({ flag_count: newCount }).eq("id", debateId);
    if (newCount >= 2) {
      await db.from("debates").update({ status: "flagged", ended_at: new Date().toISOString() }).eq("id", debateId);
    }
    return { flagCount: newCount };
  });
}

export async function cancelQueue(debateId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    await loadParticipantSide(db, debateId, user.id);
    await db.from("debates").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", debateId);
    return null;
  });
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Remove writes from `lib/debates.ts`**

Delete `joinDebateQueue`, `sendDebateMessage`, `endDebate`, and `flagDebateMessage` from `lib/debates.ts`. Keep `getQueueCounts` and `getDebateMessages`.

- [ ] **Step 6: Swap call site — `app/debate/queue/page.tsx`**

- Import `joinDebateQueue` and `cancelQueue` from `@/lib/server/debates`; keep `getQueueCounts` from `@/lib/debates`. Remove the `ensureSession` import.
- Replace the join effect (line ~37) — it currently does `ensureSession().then((userId) => joinDebateQueue(questionId, side, userId)).then(({ debate, matched }) => {...})`. Change to:
  ```typescript
  joinDebateQueue(questionId, side).then((res) => {
    if (!res.ok) { /* show an error / route back */ return; }
    const { debateId, matched } = res.data;
    // use debateId where the old code used debate.id; keep the matched handling
  });
  ```
- Replace the cancel handler's debate-delete with `await cancelQueue(debateId);`.

- [ ] **Step 7: Swap call site — `components/debate/DebateChat.tsx`**

- Import `sendDebateMessage`, `endDebate`, `flagDebateMessage` from `@/lib/server/debates`; keep `getDebateMessages` from `@/lib/debates`.
- `endDebate(debate.id)` calls (lines ~80 and ~95): unchanged signature — they still work (now return `ActionResult`, but the result is ignored). Leave as `await endDebate(debate.id);` / `endDebate(debate.id).then(() => setEnded(true));`.
- Replace `await sendDebateMessage(debate.id, mySide, content);` (line ~91) with `await sendDebateMessage(debate.id, content);` (side is derived server-side now).
- If `flagDebateMessage` is called anywhere in this file or `DebateMessage.tsx`, keep its `(messageId, debateId)` signature.

- [ ] **Step 8: Type-check + verify** — `npx tsc --noEmit` → 0. (Full debate matchmaking is hard to exercise solo; at minimum confirm the queue page and a debate page load without console errors.)

- [ ] **Step 9: Commit**

```bash
git add lib/server/debates.ts lib/server/debates.test.ts lib/debates.ts app/debate/queue/page.tsx components/debate/DebateChat.tsx
git commit -m "feat: move debate writes to server actions; derive side + verify participant"
```

---

### Task 5: Community + social server actions + call-site swaps

**Files:**
- Create: `lib/server/community.ts`, `lib/server/community.test.ts`
- Create: `lib/server/social.ts`, `lib/server/social.test.ts`
- Modify: `lib/community.ts` (remove `submitCommunityQuestion`; keep feed/question/stats reads), `lib/friends.ts` (remove `sendFriendRequest`, `respondToRequest`; keep `searchUser`, `getFriends`, `getPendingRequests`), `lib/predictions.ts` (remove `makePrediction`; keep reads)
- Modify call sites: `components/community/SubmitModal.tsx`, `app/(main)/friends/page.tsx`, `app/onboarding/friends/page.tsx`, `components/sidebar/GroupSidebar.tsx`

**Interfaces:**
- Produces (from `@/lib/server/community`): `submitCommunityQuestion(optionA: string, optionB: string): Promise<ActionResult<{ id: string }>>`.
- Produces (from `@/lib/server/social`):
  - `sendFriendRequest(toId: string): Promise<ActionResult<null>>` — `fromId` derived server-side.
  - `respondToFriendRequest(requestId: string, accept: boolean): Promise<ActionResult<null>>` — verifies the caller is the request's `to_user_id`.
  - `makePrediction(targetId: string, questionId: string, choice: "A"|"B"): Promise<ActionResult<null>>` — `predictor_id` derived server-side.

- [ ] **Step 1: Write failing tests**

Create `lib/server/community.test.ts` (validates options + derives author) and `lib/server/social.test.ts` (friend request derives `from_user_id`; `respondToFriendRequest` rejects when caller ≠ `to_user_id`). Use the same `vi.mock` pattern as Tasks 2–4 (mock `@/lib/server/auth` + `@/lib/server/supabase`). Concretely for community:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
const ensureAnonUser = vi.fn();
const insert = vi.fn();
vi.mock("@/lib/server/auth", () => ({ ensureAnonUser }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({ from: () => ({ insert: (row: unknown) => { insert(row); return { select: () => ({ single: async () => ({ data: { id: "q1" }, error: null }) }) }; } }) }),
}));
import { submitCommunityQuestion } from "@/lib/server/community";
beforeEach(() => { ensureAnonUser.mockReset(); insert.mockReset(); ensureAnonUser.mockResolvedValue({ id: "u1", isAnonymous: false }); });
describe("submitCommunityQuestion", () => {
  it("rejects too-short options without writing", async () => {
    const r = await submitCommunityQuestion("a", "b");
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
  it("writes a community question authored by the server-derived user", async () => {
    const r = await submitCommunityQuestion("cats forever", "dogs forever");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ type: "community", author_id: "u1", option_a: "cats forever" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("q1");
  });
});
```

For social, mock `from("friend_requests").select().eq().single()` to return a row with a known `to_user_id` and assert `respondToFriendRequest` rejects a non-recipient with code `not_authorized`.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/server/community.ts`**

```typescript
"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { parseOrThrow, communitySubmitSchema } from "@/lib/server/validation";
import type { ActionResult } from "@/lib/server/result";

export async function submitCommunityQuestion(optionA: string, optionB: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const input = parseOrThrow(communitySubmitSchema, { optionA, optionB });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const { data, error } = await db
      .from("questions")
      .insert({
        option_a: input.optionA,
        option_b: input.optionB,
        type: "community",
        author_id: user.id,
        debate_enabled: false,
        published_at: new Date().toISOString(),
      })
      .select().single();
    if (error) throw error;
    return { id: (data as { id: string }).id };
  });
}
```

- [ ] **Step 4: Implement `lib/server/social.ts`**

```typescript
"use server";

import { ensureAnonUser } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, friendRequestSchema, respondRequestSchema, predictionSchema } from "@/lib/server/validation";

export async function sendFriendRequest(toId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(friendRequestSchema, { toId });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const { error } = await db.from("friend_requests").insert({ from_user_id: user.id, to_user_id: input.toId, status: "pending" });
    if (error) throw error;
    return null;
  });
}

export async function respondToFriendRequest(requestId: string, accept: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(respondRequestSchema, { requestId, accept });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const { data } = await db.from("friend_requests").select("to_user_id").eq("id", input.requestId).single();
    if (!data || (data as { to_user_id: string }).to_user_id !== user.id) {
      throw new ActionError("not_authorized", "you cannot respond to this request");
    }
    await db.from("friend_requests").update({ status: input.accept ? "accepted" : "declined" }).eq("id", input.requestId);
    return null;
  });
}

export async function makePrediction(targetId: string, questionId: string, choice: "A" | "B"): Promise<ActionResult<null>> {
  return run(async () => {
    const input = parseOrThrow(predictionSchema, { targetId, questionId, choice });
    const user = await ensureAnonUser();
    const db = createServiceSupabase();
    const { error } = await db.from("predictions").upsert(
      { predictor_id: user.id, target_id: input.targetId, question_id: input.questionId, predicted_choice: input.choice },
      { onConflict: "predictor_id,target_id,question_id" }
    );
    if (error) throw error;
    return null;
  });
}
```

> If the existing `lib/predictions.ts:makePrediction` uses different column names (e.g. `predicted_choice`), match the existing schema exactly — read the current function before implementing.

- [ ] **Step 5: Run — expect PASS.**

- [ ] **Step 6: Remove the migrated writes from `lib/community.ts`, `lib/friends.ts`, `lib/predictions.ts`** (keep all read helpers).

- [ ] **Step 7: Swap call sites**

- `components/community/SubmitModal.tsx` (line ~29): import `submitCommunityQuestion` from `@/lib/server/community`; replace `const { question, error: err } = await submitCommunityQuestion(a, b, userId);` with:
  ```typescript
  const res = await submitCommunityQuestion(a, b);
  if (!res.ok) { /* set error UI */ } else { /* navigate to `/explore/${res.data.id}` */ }
  ```
- `app/(main)/friends/page.tsx` (lines ~56): import `sendFriendRequest`, `respondToFriendRequest` from `@/lib/server/social`; replace `await sendFriendRequest(userId, targetId);` with `await sendFriendRequest(targetId);` and any `respondToRequest(...)` call with `respondToFriendRequest(requestId, accept)`.
- `app/onboarding/friends/page.tsx` (line ~82): replace `await sendFriendRequest(userId, found.id);` with `await sendFriendRequest(found.id);` (import from `@/lib/server/social`).
- `components/sidebar/GroupSidebar.tsx`: import `makePrediction` from `@/lib/server/social`; drop the client-passed predictor id from its call.

- [ ] **Step 8: Type-check + verify** — `npx tsc --noEmit` → 0; submit a community question and confirm it appears.

- [ ] **Step 9: Commit**

```bash
git add lib/server/community.ts lib/server/community.test.ts lib/server/social.ts lib/server/social.test.ts lib/community.ts lib/friends.ts lib/predictions.ts components/community/SubmitModal.tsx "app/(main)/friends/page.tsx" app/onboarding/friends/page.tsx components/sidebar/GroupSidebar.tsx
git commit -m "feat: move community + social writes to server actions"
```

---

### Task 6: RLS lockdown migration + cleanup

**Files:**
- Create: `supabase/migrations/004_rls_lockdown.sql`
- Modify: `supabase/schema.sql` (replace the permissive policies with the locked-down set)
- Modify: `lib/supabase.ts` (delete `createServiceClient`)
- Modify: `app/debate/queue/page.tsx` and any remaining `ensureSession` users — none should remain after Task 4; if `lib/anon.ts` is now unused, delete it and remove `components/AnonAuthInit.tsx` usage only if nothing imports them (verify with grep first).

**Interfaces:** none (DB + cleanup).

- [ ] **Step 1: Write the RLS lockdown migration**

Create `supabase/migrations/004_rls_lockdown.sql`:
```sql
-- Phase 2 RLS lockdown: the browser (anon key) may READ where appropriate but
-- may NEVER write. All writes go through server actions using the service-role
-- key, which bypasses RLS. This is the security payoff of the server boundary.

-- Drop the old permissive write/read policies.
drop policy if exists "public insert votes" on votes;
drop policy if exists "public insert comments" on comments;
drop policy if exists "public insert comment_likes" on comment_likes;
drop policy if exists "public insert debates" on debates;
drop policy if exists "public update debates" on debates;
drop policy if exists "public insert debate_messages" on debate_messages;
drop policy if exists "public update debate_messages" on debate_messages;
drop policy if exists "auth insert friend_requests" on friend_requests;
drop policy if exists "auth update friend_requests" on friend_requests;
drop policy if exists "auth insert predictions" on predictions;
drop policy if exists "users insert own" on users;

-- Keep / (re)create SELECT-only policies for the browser.
drop policy if exists "public read questions" on questions;
create policy "read questions" on questions for select using (true);
drop policy if exists "public read votes" on votes;
create policy "read votes" on votes for select using (true);
drop policy if exists "public read comments" on comments;
create policy "read comments" on comments for select using (true);
drop policy if exists "public read debates" on debates;
create policy "read debates" on debates for select using (true);
drop policy if exists "public read debate_messages" on debate_messages;
create policy "read debate_messages" on debate_messages for select using (true);
drop policy if exists "users read own" on users;
create policy "read users" on users for select using (true);

-- Friend requests + predictions: readable only by the involved user.
drop policy if exists "public read friend_requests" on friend_requests;
create policy "read own friend_requests" on friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
drop policy if exists "public read predictions" on predictions;
create policy "read own predictions" on predictions
  for select using (auth.uid() = predictor_id or auth.uid() = target_id);

-- No INSERT/UPDATE/DELETE policies exist for the browser role on any table now.
```

- [ ] **Step 2: (Manual — controller/user) Apply migration 004 in the Supabase dashboard SQL editor.** Note in the report that this is pending manual application.

- [ ] **Step 3: Sync `supabase/schema.sql`**

In `supabase/schema.sql`, replace the block of permissive policies (the `create policy "public insert ..."`, `public update ...`, etc.) with the locked-down policy set from Step 1 (read-only public selects; involved-user selects for friend_requests/predictions; no client write policies). Keep the `alter table ... enable row level security;` lines.

- [ ] **Step 4: Delete the unused service client from `lib/supabase.ts`**

Remove the `createServiceClient` function from `lib/supabase.ts` (the new `lib/server/supabase.ts` supersedes it). Keep the browser `supabase` export used by read helpers.

- [ ] **Step 5: Retire `lib/anon.ts` if unused**

Run: `grep -rn "ensureSession\|@/lib/anon" app components lib`
If nothing imports it, delete `lib/anon.ts`. (Leave `components/AnonAuthInit.tsx` and its layout usage as-is unless grep shows it now unused — anonymous sessions are created lazily by `ensureAnonUser` server-side, so `AnonAuthInit` may be removable; only remove if no longer needed and the home page still bootstraps a session on first vote.)

- [ ] **Step 6: Type-check + full test run**

Run: `npx tsc --noEmit` → 0; `npm run test:run` → all pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/004_rls_lockdown.sql supabase/schema.sql lib/supabase.ts
git commit -m "feat: lock down RLS to read-only for the browser; remove unused service client"
```

- [ ] **Step 8: (Controller) Post-migration verification**

After the migration is applied to the DB, verify with the anon key that a direct browser write is rejected and that server actions still succeed (vote on `/` works; a raw client insert into `votes` returns an RLS error).

---

## Self-Review

- **Spec coverage:** server-action pattern (Task 1) ✓; all writes moved — votes (T2), comments (T3), debates (T4), community + social (T5) ✓; RLS lockdown (T6) ✓; service-role-only writes ✓; reads stay client-side ✓; identity derived server-side ✓; account-required gating explicitly deferred to Phase 4 (documented) ✓.
- **Placeholder scan:** Every code step shows complete code; call-site swaps name exact files, imports, and line anchors. Where the existing column names must match (predictions), the plan says to read the current file first.
- **Type consistency:** All actions return `ActionResult<T>`; `castVote` returns `VoteCounts`; `ensureAnonUser`/`createServiceSupabase`/`run`/`parseOrThrow` names match Phase 1 + Task 1.

## Notes for later phases

- Phase 3 will replace the `castVote` upsert, the `joinDebateQueue` match-or-create, and the `likeComment` insert+rpc with atomic Postgres functions, and add `comment_likes unique(comment_id, user_id)`.
- Phase 4 will switch `postComment`, `likeComment`, all debate actions, `submitCommunityQuestion`, and all social actions from `ensureAnonUser()` to `requireAccount()`.
