"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function Navbar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <nav className="sticky top-0 z-40 bg-background border-b border-border-light">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-sm font-bold text-text-primary">
          would you rather
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href="/" label="today" active={pathname === "/"} />
          <NavLink href="/history" label="history" active={pathname.startsWith("/history")} />
          <NavLink href="/you" label="you" active={pathname.startsWith("/you")} />
          <NavLink href="/friends" label="friends" active={pathname.startsWith("/friends")} />

          {userId ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="ml-3 text-xs text-text-muted hover:text-text-secondary"
            >
              sign out
            </button>
          ) : (
            <Link
              href="/signup"
              className="ml-3 px-3 py-1.5 bg-dark text-white text-xs font-semibold rounded-lg hover:bg-text-secondary transition-colors"
            >
              sign up
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
        active ? "bg-dark text-white" : "text-text-secondary hover:bg-border-light"
      }`}
    >
      {label}
    </Link>
  );
}
