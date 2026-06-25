"use client";

import { useEffect } from "react";
import { ensureSession } from "@/lib/anon";

// Boots an anonymous Supabase session on every page load if the user isn't
// already signed in. This gives every visitor a real user ID so votes and
// comments are tracked consistently, and the upgrade to a permanent account
// (username or OAuth) preserves all their data.
export function AnonAuthInit() {
  useEffect(() => {
    ensureSession().catch(() => {});
  }, []);
  return null;
}
