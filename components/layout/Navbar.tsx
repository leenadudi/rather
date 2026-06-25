"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function Navbar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [initials, setInitials] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) { setUserId(null); return; }
      setUserId(user.id);
      const { data: u } = await supabase.from("users").select("username").eq("id", user.id).single();
      if (u?.username) setInitials(u.username.slice(0, 2).toUpperCase());
    }
    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const user = session?.user;
      if (!user || user.is_anonymous) { setUserId(null); setInitials(null); return; }
      setUserId(user.id);
      const { data: u } = await supabase.from("users").select("username").eq("id", user.id).single();
      if (u?.username) setInitials(u.username.slice(0, 2).toUpperCase());
      else setInitials(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const today = new Date();
  const dateStr = today
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();

  return (
    <nav className="sticky top-0 z-40 bg-background border-b border-border-light">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: logo + date */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-text-primary">would you rather</span>
          <span className="text-sm text-text-muted">{dateStr}</span>
        </Link>

        {/* Center: nav links */}
        <div className="flex items-center gap-7">
          <NavLink href="/" label="daily" active={pathname === "/"} />
          <NavLink href="/explore" label="explore" active={pathname.startsWith("/explore")} />
          <NavLink href="/you" label="you" active={pathname.startsWith("/you")} />
        </div>

        {/* Right: user state */}
        <div className="flex items-center gap-2">
          {pathname.startsWith("/explore") && (
            <button
              onClick={() => window.dispatchEvent(new Event("wyr:submit"))}
              className="hidden sm:block px-4 py-1.5 bg-dark text-white text-xs font-semibold rounded-full hover:bg-text-secondary transition-colors"
            >
              + submit a wyr
            </button>
          )}
          {userId ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-8 h-8 rounded-full bg-dark text-white text-xs font-bold flex items-center justify-center hover:bg-text-secondary transition-colors"
              title="sign out"
            >
              {initials ?? "?"}
            </button>
          ) : (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-side-b-bg rounded-full">
                <svg className="w-3 h-3 text-side-b" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                <span className="text-xs text-side-b font-medium">anonymous</span>
              </div>
              <Link
                href="/signin"
                className="px-4 py-1.5 bg-dark text-white text-xs font-semibold rounded-full hover:bg-text-secondary transition-colors"
              >
                sign in
              </Link>
            </>
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
      className={`text-sm font-medium pb-0.5 transition-colors ${
        active
          ? "text-text-primary border-b-2 border-text-primary"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
    </Link>
  );
}
