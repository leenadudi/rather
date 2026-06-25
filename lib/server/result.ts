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
