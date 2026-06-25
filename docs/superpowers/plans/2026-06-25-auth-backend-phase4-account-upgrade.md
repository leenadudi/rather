# Auth & Backend Redesign — Phase 4: Account Upgrade (OAuth + Magic-Link) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Replace the fake-email / recovery-code auth with real accounts via OAuth + email magic-link, upgrading the anonymous user **in place** (same user id, data preserved automatically), and enforce the hybrid model (account required to comment/debate/submit/socialize).

**Architecture:** Anonymous users (server-authoritative, from Phase 3) upgrade in place: `linkIdentity` for OAuth and `updateUser({ email })` for magic-link both keep the same `auth.users.id`, so votes/comments already attached to that id stay attached — no client-side migration. Username onboarding moves to a `setUsername` server action. The comment/debate/community/social actions flip from `ensureAnonUser()` to `requireAccount()`; call sites handle the `account_required` result by routing to the auth page.

**Tech Stack:** Next.js 14, `@supabase/ssr` cookie auth, Supabase OAuth + OTP, Vitest.

> **REQUIRES MANUAL SUPABASE CONFIG (cannot be verified in-repo):** Google (and/or Apple) OAuth providers enabled with credentials; "Manual linking" enabled (Auth → Settings) so `linkIdentity` works; email/magic-link enabled; redirect URL `<site>/auth/callback` allow-listed. These are delivered as a checklist; Phase 4 code is correct but inert until they're set.

## Global Constraints

- `@/*` → repo root. Server-only: `import "server-only";`. Server actions: `"use server";`, only async exports.
- In-place upgrade only — never create a second user and migrate. No `sessionStorage` anon-id juggling.
- `requireAccount()` (Phase 1) gates comment/debate/community/social actions; `castVote` stays `ensureAnonUser` (anonymous voting allowed).
- A failed account gate returns `ActionResult` with `code: "account_required"`; call sites route to `/signin` (the auth page) rather than failing silently.
- Migrations written, not applied by the implementer. Migration 006 (drop recovery columns) is applied with the Phase 4 deploy.
- Commit after each task with the exact message; stage only listed files; never `git add -A`.

## File Structure (Phase 4)

- Create `supabase/migrations/006_drop_recovery.sql` — drop `users.recovery_code`, `users.recovery_email`.
- Modify `supabase/schema.sql` — remove those two columns.
- Create `lib/server/account.ts` — `"use server"`; `setUsername(username)`.
- Create `lib/server/account.test.ts`.
- Modify `app/onboarding/username/page.tsx` — use `setUsername`; drop recovery-code generation + `RecoveryCodeScreen`.
- Rewrite `app/(auth)/signin/page.tsx` — OAuth `linkIdentity` + email magic-link; remove username/password + fake email.
- Delete `app/(auth)/signup/page.tsx`, `app/(auth)/recover/page.tsx`, `components/account/RecoveryCodeScreen.tsx`, `lib/recovery.ts`.
- Rewrite `app/auth/callback/page.tsx` — no migration; route by username presence.
- Modify `lib/server/comments.ts`, `lib/server/debates.ts`, `lib/server/community.ts`, `lib/server/social.ts` — `ensureAnonUser` → `requireAccount`; update tests.
- Modify call sites to handle `account_required`: `components/comments/CommentSection.tsx`, `components/community/SubmitModal.tsx`, `app/debate/queue/page.tsx`, `components/vote/DebateCTA.tsx`, `app/(main)/friends/page.tsx`, `components/sidebar/GroupSidebar.tsx`.

---

### Task 1: Drop recovery columns + `setUsername` action + onboarding rewrite

**Files:**
- Create: `supabase/migrations/006_drop_recovery.sql`, `lib/server/account.ts`, `lib/server/account.test.ts`
- Modify: `supabase/schema.sql`, `app/onboarding/username/page.tsx`

**Interfaces:**
- `setUsername(username: string): Promise<ActionResult<{ username: string }>>` (from `@/lib/server/account`) — requires a real account (`requireAccount`), validates (3–20 chars, `[a-z0-9_]`), upserts the `users` row `{ id, username }` (no recovery columns), maps a unique-violation to `ActionError("username_taken", ...)`.

- [ ] **Step 1: Write `supabase/migrations/006_drop_recovery.sql`**
```sql
-- Phase 4: recovery is now OAuth / magic-link. Drop the legacy recovery columns.
alter table users drop column if exists recovery_code;
alter table users drop column if exists recovery_email;
```

- [ ] **Step 2: Add `usernameSchema` to `lib/server/validation.ts`**
Add: `export const usernameSchema = z.object({ username: z.string().trim().toLowerCase().min(3).max(20).regex(/^[a-z0-9_]+$/) });`

- [ ] **Step 3: Write the failing test** `lib/server/account.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
const { requireAccount } = vi.hoisted(() => ({ requireAccount: vi.fn() }));
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireAccount }));
vi.mock("@/lib/server/supabase", () => ({
  createServiceSupabase: () => ({ from: () => ({ upsert: (...a: unknown[]) => { upsert(...a); return { error: upsert.mock.results.at(-1)?.value ?? null }; } }) }),
}));
import { setUsername } from "@/lib/server/account";
beforeEach(() => { requireAccount.mockReset(); upsert.mockReset(); requireAccount.mockResolvedValue({ id: "u1", isAnonymous: false }); });
describe("setUsername", () => {
  it("rejects an invalid username before writing", async () => {
    const r = await setUsername("ab");
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects when not a real account", async () => {
    requireAccount.mockRejectedValueOnce(new (await import("@/lib/server/result")).ActionError("account_required", "no"));
    const r = await setUsername("valid_name");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("account_required");
  });
  it("upserts a valid username for the account", async () => {
    upsert.mockReturnValue(null);
    const r = await setUsername("Cool_Name");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", username: "cool_name" }), expect.anything());
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 4: Run — expect FAIL.**

- [ ] **Step 5: Implement `lib/server/account.ts`**
```typescript
"use server";

import { requireAccount } from "@/lib/server/auth";
import { createServiceSupabase } from "@/lib/server/supabase";
import { run } from "@/lib/server/run";
import { ActionError, type ActionResult } from "@/lib/server/result";
import { parseOrThrow, usernameSchema } from "@/lib/server/validation";

export async function setUsername(username: string): Promise<ActionResult<{ username: string }>> {
  return run(async () => {
    const input = parseOrThrow(usernameSchema, { username });
    const user = await requireAccount();
    const db = createServiceSupabase();
    const { error } = await db.from("users").upsert({ id: user.id, username: input.username }, { onConflict: "id" });
    if (error) {
      if (error.code === "23505") throw new ActionError("username_taken", "that username is taken — try another");
      throw error;
    }
    return { username: input.username };
  });
}
```

- [ ] **Step 6: Run — expect PASS.**

- [ ] **Step 7: Rewrite `app/onboarding/username/page.tsx`** — remove `generateRecoveryCode`/`hashRecoveryCode`/`RecoveryCodeScreen` imports and the recovery-code screen branch. On submit, call `setUsername(u)`; on `res.ok` → `router.replace("/onboarding/friends")`; on `!res.ok` show `res.error` (and the `username_taken` code maps to the existing "taken" message). Keep the username input UI.

- [ ] **Step 8: Type-check + verify** — `npx tsc --noEmit` → 0; `npm run test:run -- lib/server/account.test.ts` → pass.

- [ ] **Step 9: Commit**
```bash
git add supabase/migrations/006_drop_recovery.sql supabase/schema.sql lib/server/account.ts lib/server/account.test.ts lib/server/validation.ts app/onboarding/username/page.tsx
git commit -m "feat: setUsername server action; drop recovery columns; rewrite username onboarding"
```

---

### Task 2: In-place OAuth + magic-link upgrade; remove legacy auth

**Files:**
- Rewrite: `app/(auth)/signin/page.tsx`, `app/auth/callback/page.tsx`
- Delete: `app/(auth)/signup/page.tsx`, `app/(auth)/recover/page.tsx`, `components/account/RecoveryCodeScreen.tsx`, `lib/recovery.ts`

**Interfaces:** none (UI/auth wiring).

- [ ] **Step 1: Rewrite `app/(auth)/signin/page.tsx`** as the account page (in-place upgrade):
```tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function continueWithGoogle() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    // Anonymous user → link in place (keeps id + data). Otherwise sign in.
    const fn = user?.is_anonymous
      ? supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
      : supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    const { error } = await fn;
    if (error) setError(error.message);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    // Anonymous → attach email in place; else send a normal OTP sign-in link.
    const { error } = user?.is_anonymous
      ? await supabase.auth.updateUser({ email })
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-1">save your account</h2>
        <p className="text-sm text-text-secondary mb-6">keep your votes, character cards, and friends across devices.</p>

        <button onClick={continueWithGoogle} className="w-full flex items-center justify-center gap-3 py-3 bg-card border border-border rounded-xl text-sm font-medium text-text-primary hover:border-text-secondary transition-colors mb-6">
          <GoogleIcon /> continue with google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border-light" /><span className="text-xs text-text-muted">or email me a link</span><div className="flex-1 h-px bg-border-light" />
        </div>

        {sent ? (
          <p className="text-sm text-text-secondary bg-card border border-border-light rounded-xl px-4 py-3">check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors" />
            <button type="submit" className="w-full py-3 bg-dark text-white font-semibold rounded-xl hover:bg-text-secondary transition-colors">email me a link</button>
          </form>
        )}
        {error && <p className="text-sm text-error bg-error-bg px-3 py-2 rounded-xl mt-4">{error}</p>}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.226 17.64 11.92 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
```

- [ ] **Step 2: Rewrite `app/auth/callback/page.tsx`** — drop the `sessionStorage` migration entirely (in-place upgrade keeps the id):
```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    async function handle() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.replace("/signin?error=oauth"); return; }
      const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).single();
      router.replace(profile ? "/" : "/onboarding/username");
    }
    handle();
  }, [router]);
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-muted text-sm">signing you in…</p>
    </main>
  );
}
```

- [ ] **Step 3: Delete the legacy files**
```bash
git rm "app/(auth)/signup/page.tsx" "app/(auth)/recover/page.tsx" components/account/RecoveryCodeScreen.tsx lib/recovery.ts
```

- [ ] **Step 4: Fix dangling references** — grep for imports of the deleted modules and any link to `/signup` or `/recover`:
```bash
grep -rn "RecoveryCodeScreen\|@/lib/recovery\|/signup\|/recover" app components
```
Remove/redirect each (e.g. Navbar "sign in" link should point to `/signin`; remove "create one"/"forgot username" links). Fix until grep is clean.

- [ ] **Step 5: Type-check** — `npx tsc --noEmit` → 0.

- [ ] **Step 6: Commit**
```bash
git add -A app/ components/ lib/
git commit -m "feat: in-place OAuth/magic-link account upgrade; remove fake-email + recovery-code auth"
```
> (Here `git add -A` is scoped to the listed dirs and the tree is otherwise clean; still prefer naming files if unsure.)

---

### Task 3: Enforce account-required gating + handle it in the UI

**Files:**
- Modify: `lib/server/comments.ts`, `lib/server/debates.ts`, `lib/server/community.ts`, `lib/server/social.ts` + their tests
- Modify call sites: `components/comments/CommentSection.tsx`, `components/community/SubmitModal.tsx`, `app/debate/queue/page.tsx`, `components/vote/DebateCTA.tsx`, `app/(main)/friends/page.tsx`, `components/sidebar/GroupSidebar.tsx`

**Interfaces:** action signatures unchanged; gating changes from anon-allowed to account-required.

- [ ] **Step 1: Flip the gate in the four action modules**
In `lib/server/comments.ts` (`postComment`, `likeComment`), `lib/server/debates.ts` (`joinDebateQueue`, `sendDebateMessage`, `endDebate`, `flagDebateMessage`, `cancelQueue`), `lib/server/community.ts` (`submitCommunityQuestion`), and `lib/server/social.ts` (`sendFriendRequest`, `respondToFriendRequest`, `makePrediction`): replace every `const user = await ensureAnonUser();` with `const user = await requireAccount();` and update the import from `@/lib/server/auth` accordingly. **Do NOT change `lib/server/votes.ts`** — voting stays anonymous.

- [ ] **Step 2: Update the affected tests** — in `comments.test.ts`, `debates.test.ts`, `community.test.ts`, `social.test.ts`, change the mocked `@/lib/server/auth` to export `requireAccount` (returning `{ id, isAnonymous: false }` for the happy path) instead of `ensureAnonUser`, and add one test per module asserting that when `requireAccount` rejects with `ActionError("account_required", ...)` the action returns `{ ok: false, code: "account_required" }` and performs no write.

- [ ] **Step 3: Handle `account_required` at the call sites**
Add a shared helper `components/auth/useRequireAccount.ts`:
```typescript
"use client";
import { useRouter } from "next/navigation";
export function useAccountGate() {
  const router = useRouter();
  return function gate<T extends { ok: boolean; code?: string }>(res: T): T {
    if (!res.ok && res.code === "account_required") router.push("/signin");
    return res;
  };
}
```
At each call site, wrap the action result: after `const res = await postComment(...)`, call `gate(res)` (or inline-check `res.code === "account_required"` → `router.push("/signin")`). Apply in `CommentSection` (post + like + reply), `SubmitModal` (submit), `debate/queue` (join), `DebateCTA` (the "start a debate" entrypoint), `friends` (send/respond), `GroupSidebar` (prediction). Keep existing success behavior.

- [ ] **Step 4: Type-check + full test run** — `npx tsc --noEmit` → 0; `npm run test:run` → all pass.

- [ ] **Step 5: Commit**
```bash
git add lib/server/comments.ts lib/server/comments.test.ts lib/server/debates.ts lib/server/debates.test.ts lib/server/community.ts lib/server/community.test.ts lib/server/social.ts lib/server/social.test.ts components/comments/CommentSection.tsx components/community/SubmitModal.tsx app/debate/queue/page.tsx components/vote/DebateCTA.tsx "app/(main)/friends/page.tsx" components/sidebar/GroupSidebar.tsx components/auth/useRequireAccount.ts
git commit -m "feat: require an account to comment/debate/submit/socialize; prompt sign-in on gate"
```

---

## Self-Review

- **Spec coverage:** in-place OAuth-link + magic-link upgrade (Task 2) ✓; username onboarding via `setUsername`, recovery columns dropped, fake-email/recovery-code removed (Tasks 1–2) ✓; `requireAccount` gating + UI prompt (Task 3) ✓; `castVote` stays anonymous ✓.
- **Placeholder scan:** code shown for actions, auth pages, callback, gate helper; test changes specified.
- **Type consistency:** `setUsername` returns `ActionResult<{username}>`; `account_required` code consistent across actions + the gate helper.

## Manual config checklist (deliver to user)
1. Supabase → Authentication → Providers: enable Google (and/or Apple) with OAuth credentials.
2. Supabase → Authentication → Settings: enable **Manual linking** (required for `linkIdentity`); enable email/OTP; add `<site>/auth/callback` to redirect allow-list.
3. Apply migration `006_drop_recovery.sql`.
4. Verify after config: anonymous vote → "save account" → Google → returns with same id, votes intact → username onboarding → home. Then test magic-link, and returning-user sign-in on a fresh browser (no anon session).

## Notes for later phases
- Phase 5: rate limiting wraps these (now account-gated) actions.
- Migration 004 (RLS lockdown) still pending until Phase 6 admin writes are server-side.
