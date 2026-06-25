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
