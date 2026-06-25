# Auth & Backend Redesign — Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the server-side foundation — test tooling, the three Supabase clients, cookie-based session refresh, the session/auth helper layer, and a safe schema cleanup — without changing app behavior, so later phases can move writes server-side.

**Architecture:** Approach A from the design doc. This phase is purely additive infrastructure plus one safe, app-compatible schema cleanup. It introduces a browser (read-only) client, a cookie-aware server client, and a service-role client; middleware that keeps the Supabase session fresh in cookies; and typed `ActionResult` + auth-guard helpers that every future server action will use. RLS lockdown and all write-path changes are deliberately deferred to Phase 2+ so the app keeps working after this phase.

**Tech Stack:** Next.js 14.2.35 (App Router), `@supabase/ssr` ^0.12.0, `@supabase/supabase-js` ^2.108.2, TypeScript 5, Vitest (added here).

## Global Constraints

- Node imports use the path alias `@/*` → repo root (e.g. `@/lib/server/auth`). Exact value from `tsconfig.json`.
- Next.js version is pinned at `14.2.35`; do not upgrade Next in this plan.
- `@supabase/ssr` is already installed at `^0.12.0`; do not add a different Supabase auth-helper package.
- Server-only modules must start with `import "server-only";` so they can never be bundled into the browser.
- Secrets: `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSWORD` are server-only (no `NEXT_PUBLIC_` prefix). Public values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Tests must be hermetic: unit tests mock the Supabase clients and require no network or real env vars.
- Commit after every task using the exact message shown.

---

## File Structure (Phase 1)

- Create `vitest.config.ts` — Vitest config (node env, `server-only` aliased to a no-op, `@/*` alias).
- Create `lib/server/result.ts` — `ActionResult<T>`, `ActionError`, `ok()`, `fail()`.
- Create `lib/server/result.test.ts` — unit tests for the result helpers.
- Create `lib/supabase/client.ts` — browser client (`createBrowserSupabase`).
- Create `lib/supabase/server.ts` — cookie-aware server client (`createServerSupabase`).
- Create `lib/server/supabase.ts` — service-role client (`createServiceSupabase`).
- Create `lib/server/supabase.test.ts` — unit test for the service-role env guard.
- Create `lib/server/auth.ts` — `getSessionUser`, `requireAccount`, `ensureAnonUser`.
- Create `lib/server/auth.test.ts` — unit tests for the auth helpers (mocked client).
- Modify `middleware.ts` — add `@supabase/ssr` session refresh; keep the admin Basic Auth; broaden the matcher.
- Create `supabase/migrations/003_schema_cleanup.sql` — drop dead columns (safe, app-compatible).
- Modify `lib/debates.ts:79-92` — `getQueueCounts` stops selecting the dropped `device_*` columns.
- Modify `package.json` — add `vitest` dev dep + `test` / `test:run` scripts.

> **Not in this phase (deferred for correctness — see roadmap at end):** RLS write-lockdown (end of Phase 2), `users.recovery_*` removal (Phase 4), `comment_likes` unique constraint (Phase 3), `rate_limits` table (Phase 5), `reports` table + `questions.status` (Phase 6).

---

### Task 1: Test tooling (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/server/result.ts` (placeholder so the sample test has something to import is NOT needed — sample test is self-contained)
- Test: `lib/__sanity__.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (watch) and `npm run test:run` (single run) scripts; a Vitest config that aliases `server-only` to a no-op and resolves `@/*` to the repo root.

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: `vitest` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to `package.json`**

In `package.json`, add these two entries to the `"scripts"` object (alongside the existing `dev`/`build`/`start`/`lint`):
```json
    "test": "vitest",
    "test:run": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      // server-only throws if imported outside a React Server Component bundle;
      // alias it to an empty module so server modules can be unit-tested in node.
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 4: Create the `server-only` stub**

Create `vitest.server-only-stub.ts`:
```typescript
// Empty stub so `import "server-only"` is a no-op under Vitest (node).
export {};
```

- [ ] **Step 5: Write a sanity test**

Create `lib/__sanity__.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("test tooling", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it and verify it passes**

Run: `npm run test:run`
Expected: PASS — 1 passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.server-only-stub.ts lib/__sanity__.test.ts
git commit -m "chore: add Vitest test tooling"
```

---

### Task 2: Typed action results

**Files:**
- Create: `lib/server/result.ts`
- Test: `lib/server/result.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }`
  - `class ActionError extends Error { code: string }` — `new ActionError(code: string, message: string)`
  - `function ok<T>(data: T): ActionResult<T>`
  - `function fail(error: string, code?: string): ActionResult<never>`
  - `function resultFromError(e: unknown): ActionResult<never>` — maps an `ActionError` to `fail(message, code)`, any other error to `fail("something went wrong", "internal")`.

- [ ] **Step 1: Write the failing test**

Create `lib/server/result.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { ok, fail, ActionError, resultFromError } from "@/lib/server/result";

describe("result helpers", () => {
  it("ok() wraps data", () => {
    expect(ok({ n: 1 })).toEqual({ ok: true, data: { n: 1 } });
  });

  it("fail() carries error + optional code", () => {
    expect(fail("nope", "bad")).toEqual({ ok: false, error: "nope", code: "bad" });
    expect(fail("nope")).toEqual({ ok: false, error: "nope", code: undefined });
  });

  it("resultFromError maps ActionError to fail with its code", () => {
    const r = resultFromError(new ActionError("account_required", "need an account"));
    expect(r).toEqual({ ok: false, error: "need an account", code: "account_required" });
  });

  it("resultFromError hides unknown errors behind a generic message", () => {
    const r = resultFromError(new Error("db exploded with secret details"));
    expect(r).toEqual({ ok: false, error: "something went wrong", code: "internal" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- lib/server/result.test.ts`
Expected: FAIL — cannot find module `@/lib/server/result`.

- [ ] **Step 3: Write the implementation**

Create `lib/server/result.ts`:
```typescript
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export class ActionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code?: string): ActionResult<never> {
  return { ok: false, error, code };
}

export function resultFromError(e: unknown): ActionResult<never> {
  if (e instanceof ActionError) return fail(e.message, e.code);
  return fail("something went wrong", "internal");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- lib/server/result.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/server/result.ts lib/server/result.test.ts
git commit -m "feat: add typed ActionResult helpers for server actions"
```

---

### Task 3: Supabase clients (browser, server, service-role)

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/server/supabase.ts`
- Test: `lib/server/supabase.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createBrowserSupabase(): SupabaseClient` (from `@/lib/supabase/client`) — anon-key client for browser reads + realtime.
  - `createServerSupabase(): SupabaseClient` (from `@/lib/supabase/server`) — anon-key client wired to Next cookies; used in Server Actions / Route Handlers / RSC to read the session.
  - `createServiceSupabase(): SupabaseClient` (from `@/lib/server/supabase`) — service-role client that bypasses RLS; throws if `SUPABASE_SERVICE_ROLE_KEY` is missing.

- [ ] **Step 1: Create the browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

// Browser client: anon key, used ONLY for reads and realtime subscriptions.
// All writes go through server actions (see lib/server/*).
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create the cookie-aware server client**

Create `lib/supabase/server.ts`:
```typescript
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server client: anon key, but reads/writes the Supabase session from Next's
// cookie store so server code knows who the caller is. In a Server Component the
// cookie store is read-only and set() throws — that's expected and ignored; the
// session refresh happens in middleware instead.
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (read-only cookies) — safe to ignore.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Write the failing test for the service-role env guard**

Create `lib/server/supabase.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("createServiceSupabase", () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });
  afterEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = original;
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  });

  it("throws when the service role key is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createServiceSupabase } = await import("@/lib/server/supabase");
    expect(() => createServiceSupabase()).toThrow(/service role/i);
  });

  it("constructs a client when the key is present", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    const { createServiceSupabase } = await import("@/lib/server/supabase");
    const client = createServiceSupabase();
    expect(client.auth).toBeDefined();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test:run -- lib/server/supabase.test.ts`
Expected: FAIL — cannot find module `@/lib/server/supabase`.

- [ ] **Step 5: Create the service-role client**

Create `lib/server/supabase.ts`:
```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. NEVER import this into client code.
// Used by server actions to perform validated writes.
export function createServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY — service role client unavailable");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:run -- lib/server/supabase.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/server/supabase.ts lib/server/supabase.test.ts
git commit -m "feat: add browser, cookie-aware server, and service-role Supabase clients"
```

---

### Task 4: Session & auth-guard helpers

**Files:**
- Create: `lib/server/auth.ts`
- Test: `lib/server/auth.test.ts`

**Interfaces:**
- Consumes: `createServerSupabase` from `@/lib/supabase/server`; `ActionError` from `@/lib/server/result`.
- Produces:
  - `type SessionUser = { id: string; isAnonymous: boolean }`
  - `getSessionUser(): Promise<SessionUser | null>` — current user from cookies, or null.
  - `requireAccount(): Promise<SessionUser>` — returns a non-anonymous user, else throws `ActionError("account_required", ...)`.
  - `ensureAnonUser(): Promise<SessionUser>` — returns the current user, or creates an anonymous one and returns it.

- [ ] **Step 1: Write the failing tests (mocked Supabase client)**

Create `lib/server/auth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cookie-aware server client so these tests are hermetic.
const getUser = vi.fn();
const signInAnonymously = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({ auth: { getUser, signInAnonymously } }),
}));

import { getSessionUser, requireAccount, ensureAnonUser } from "@/lib/server/auth";
import { ActionError } from "@/lib/server/result";

beforeEach(() => {
  getUser.mockReset();
  signInAnonymously.mockReset();
});

describe("getSessionUser", () => {
  it("returns null when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getSessionUser()).toBeNull();
  });

  it("maps an anonymous user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "a1", is_anonymous: true } } });
    expect(await getSessionUser()).toEqual({ id: "a1", isAnonymous: true });
  });

  it("treats a missing is_anonymous flag as a real account", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await getSessionUser()).toEqual({ id: "u1", isAnonymous: false });
  });
});

describe("requireAccount", () => {
  it("throws account_required when anonymous", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "a1", is_anonymous: true } } });
    await expect(requireAccount()).rejects.toMatchObject({ code: "account_required" });
  });

  it("throws account_required when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAccount()).rejects.toBeInstanceOf(ActionError);
  });

  it("returns the user when it is a real account", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: false } } });
    expect(await requireAccount()).toEqual({ id: "u1", isAnonymous: false });
  });
});

describe("ensureAnonUser", () => {
  it("returns the existing user without creating one", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", is_anonymous: false } } });
    expect(await ensureAnonUser()).toEqual({ id: "u1", isAnonymous: false });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates an anonymous user when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    signInAnonymously.mockResolvedValue({ data: { user: { id: "a9" } }, error: null });
    expect(await ensureAnonUser()).toEqual({ id: "a9", isAnonymous: true });
    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it("throws when anonymous sign-in fails", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    signInAnonymously.mockResolvedValue({ data: { user: null }, error: { message: "boom" } });
    await expect(ensureAnonUser()).rejects.toMatchObject({ code: "auth_failed" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- lib/server/auth.test.ts`
Expected: FAIL — cannot find module `@/lib/server/auth`.

- [ ] **Step 3: Write the implementation**

Create `lib/server/auth.ts`:
```typescript
import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { ActionError } from "@/lib/server/result";

export type SessionUser = { id: string; isAnonymous: boolean };

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, isAnonymous: data.user.is_anonymous ?? false };
}

export async function requireAccount(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) {
    throw new ActionError("account_required", "you need an account to do that");
  }
  return user;
}

export async function ensureAnonUser(): Promise<SessionUser> {
  const existing = await getSessionUser();
  if (existing) return existing;

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new ActionError("auth_failed", "could not start a session");
  }
  return { id: data.user.id, isAnonymous: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- lib/server/auth.test.ts`
Expected: PASS — all tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add lib/server/auth.ts lib/server/auth.test.ts
git commit -m "feat: add session and account-guard helpers for server actions"
```

---

### Task 5: Middleware session refresh (keep admin Basic Auth)

**Files:**
- Modify: `middleware.ts` (full rewrite of the existing admin-only file)

**Interfaces:**
- Consumes: `@supabase/ssr` `createServerClient`.
- Produces: middleware that (a) refreshes the Supabase session cookie on every matched request, and (b) still enforces HTTP Basic Auth on `/admin`. Matcher broadened to all routes except Next internals and static assets.

> Note: middleware runs on the Edge runtime; there is no automated unit test here. Verification is via the dev server and curl (Steps 3–4).

- [ ] **Step 1: Rewrite `middleware.ts`**

Replace the entire contents of `middleware.ts` with:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Run on everything except Next internals and static asset files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};

// HTTP Basic Auth gate for /admin (server-only ADMIN_PASSWORD).
function adminGate(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith("/admin")) return null;

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse("admin access is not configured", { status: 503 });
  }
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password === expected) return null; // authorized — fall through
  }
  return new NextResponse("authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export async function middleware(req: NextRequest) {
  const blocked = adminGate(req);
  if (blocked) return blocked;

  // Refresh the Supabase session and propagate refreshed cookies.
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Start the dev server and verify a normal page still loads**

Run (in one terminal): `npm run dev`
Then: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` (use whatever port it reports)
Expected: `200`.

- [ ] **Step 4: Verify admin is still gated and the matcher didn't break it**

Run:
```bash
curl -s -o /dev/null -w "no-auth: %{http_code}\n" http://localhost:3000/admin
PW=$(grep -E '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"'\''')
curl -s -o /dev/null -w "with-auth: %{http_code}\n" -u "admin:$PW" http://localhost:3000/admin
```
Expected: `no-auth: 401` and `with-auth: 200`.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "feat: refresh Supabase session in middleware; keep admin Basic Auth"
```

---

### Task 6: Safe schema cleanup migration

**Files:**
- Create: `supabase/migrations/003_schema_cleanup.sql`
- Modify: `lib/debates.ts:79-92` (`getQueueCounts`)
- Modify: `supabase/schema.sql` (keep the canonical schema in sync)

**Interfaces:**
- Consumes: nothing.
- Produces: dead columns removed from `votes`, `comments`, `comment_likes`, `debates`. `getQueueCounts` no longer references `device_*` columns.

> These columns are confirmed unused by app writes; only `getQueueCounts` reads `device_a_id`/`device_b_id`, which Step 3 fixes in the same task. No CLI is available, so the migration is applied via the Supabase dashboard SQL editor (Step 2). Data is disposable (pre-launch).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/003_schema_cleanup.sql`:
```sql
-- Phase 1 schema cleanup: drop dead columns that no app write ever populates.
-- Pre-launch, data is disposable. Coupled schema changes (recovery_*, reports,
-- status, rate_limits, comment_likes unique) land in their own later phases.

alter table votes        drop column if exists device_id;
alter table votes        drop column if exists vote_changed;
alter table comments     drop column if exists device_id;
alter table comment_likes drop column if exists device_id;
alter table debates      drop column if exists device_a_id;
alter table debates      drop column if exists device_b_id;
```

- [ ] **Step 2: Apply the migration**

In the Supabase dashboard → SQL Editor → New query, paste the contents of `supabase/migrations/003_schema_cleanup.sql` and Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Update `getQueueCounts` to stop selecting dropped columns**

In `lib/debates.ts`, replace the `getQueueCounts` function (currently lines 79–92):
```typescript
export async function getQueueCounts(questionId: string): Promise<{ a: number; b: number }> {
  const { data } = await supabase
    .from("debates")
    .select("user_a_id, user_b_id")
    .eq("question_id", questionId)
    .eq("status", "waiting");

  let a = 0, b = 0;
  for (const row of data ?? []) {
    if (row.user_a_id) a++;
    if (row.user_b_id) b++;
  }
  return { a, b };
}
```

- [ ] **Step 4: Update the canonical schema**

In `supabase/schema.sql`, in the `votes` table remove the `device_id text,` and `vote_changed boolean default false,` lines; in `comments` remove `device_id text,`; in `comment_likes` remove `device_id text,`; in `debates` remove `device_a_id text,` and `device_b_id text,`. (Leave all other columns and the `unique` constraints intact.)

- [ ] **Step 5: Type-check and verify the queue still works**

Run: `npx tsc --noEmit`
Expected: exit 0.

With the dev server running, load the home page in a browser, vote, and confirm the "waiting to debate" count renders without console/network errors (it now reads only `user_a_id`/`user_b_id`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/003_schema_cleanup.sql supabase/schema.sql lib/debates.ts
git commit -m "feat: drop dead device/vote_changed columns; simplify getQueueCounts"
```

---

## Phase 1 Self-Review

- **Spec coverage (Phase 1 portion):** Vitest tooling (Task 1) ✓; browser/server/service client split (Task 3) ✓; cookie session refresh middleware (Task 5) ✓; lazy-anon helper `ensureAnonUser` + `requireAccount` guard (Task 4) ✓; typed result pattern scaffold (Task 2) ✓; schema groundwork (Task 6, safe subset) ✓. Deferred items are listed in the roadmap with their target phase.
- **Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output.
- **Type consistency:** `SessionUser` shape, `ActionResult`/`ActionError`/`ok`/`fail`/`resultFromError` signatures, and `create*Supabase()` names are used identically across Tasks 2–4.

---

## Roadmap: Phases 2–6 (each becomes its own plan)

These are intentionally **not** detailed here; each will be written as its own bite-sized plan when we reach it, building on Phase 1's helpers. Sequencing is chosen so the app works after every phase.

- **Phase 2 — Writes → server actions.** Port each `lib/` write (`castVote`, `postComment`, `likeComment`, debate ops, `submitCommunityQuestion`, friends, predictions) into `lib/server/<domain>.ts` server actions using the `getSessionUser/requireAccount → validate (zod) → work via service client → ActionResult` pattern; swap client call sites to the actions; **then apply the RLS write-lockdown migration** (`004_rls_lockdown.sql`) plus an integration test proving the anon key cannot write. (RLS lockdown moved here from Phase 1 so the app is never broken between phases.)
- **Phase 3 — Atomic Postgres functions.** `cast_vote`, `join_debate` (`FOR UPDATE SKIP LOCKED`), `like_comment`; add the `comment_likes` `unique(comment_id, user_id)` constraint here; route the relevant actions through these RPCs; concurrency integration tests.
- **Phase 4 — Account upgrade flow.** In-place OAuth link + email magic-link; username onboarding via `setUsername`; **drop `users.recovery_code` / `recovery_email`**; delete the fake-email scheme, `lib/recovery.ts`, recovery-code UI, and the old client-side vote/comment migration code.
- **Phase 5 — Rate limiting.** `rate_limits` table + `checkRateLimit` helper wired as the third step of the action pattern on abusable writes.
- **Phase 6 — Report-based moderation.** `reports` table + `questions.status`; `reportContent` action; hide-pending-review threshold; admin review queue in the existing protected `/admin` page.
