"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function applyUser(user: { id: string } | null | undefined) {
      if (!user) { setUserId(null); setUsername(null); setAvatarColor(null); return; }
      setUserId(user.id);
      const { data: u } = await supabase.from("users").select("username, avatar_color").eq("id", user.id).single();
      setUsername(u?.username ?? null);
      setAvatarColor(u?.avatar_color ?? null);
    }

    supabase.auth.getUser().then(({ data }) => applyUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => applyUser(session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the profile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
  }

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
          <button
            onClick={() => {
              // On /explore the page listens for this event and opens the modal
              // in place; elsewhere, navigate to explore with the modal open.
              if (pathname.startsWith("/explore")) window.dispatchEvent(new Event("wyr:submit"));
              else router.push("/explore?submit=1");
            }}
            className="hidden sm:block px-4 py-1.5 bg-dark text-white text-xs font-semibold rounded-full hover:bg-text-secondary transition-colors"
          >
            + submit a wyr
          </button>
          {userId ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-full hover:opacity-80 transition-opacity ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="account"
              >
                <Avatar seed={username ?? userId} color={avatarColor} size={32} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-44 bg-card border border-border-light rounded-xl shadow-lg py-1 z-50"
                >
                  {username && (
                    <div className="px-4 py-2 text-sm font-semibold text-text-primary truncate border-b border-border-light mb-1">
                      {username}
                    </div>
                  )}
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
                  >
                    settings
                  </Link>
                  <div className="my-1 h-px bg-border-light" />
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-background transition-colors"
                  >
                    log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/signin"
              className="px-4 py-1.5 bg-dark text-white text-xs font-semibold rounded-full hover:bg-text-secondary transition-colors"
            >
              create account
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
