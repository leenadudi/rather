import { ActionResult, ok, resultFromError } from "@/lib/server/result";

// Wraps an action body: returns ok(data) on success, or a sanitized fail() on throw.
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return resultFromError(e);
  }
}
