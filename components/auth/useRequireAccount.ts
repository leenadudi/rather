"use client";
import { useRouter } from "next/navigation";
export function useAccountGate() {
  const router = useRouter();
  return function gate<T extends { ok: boolean; code?: string }>(res: T): T {
    if (!res.ok && res.code === "account_required") router.push("/signin");
    return res;
  };
}
