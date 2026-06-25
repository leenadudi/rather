"use client";

import Link from "next/link";

export function FriendGate() {
  return (
    <div className="relative">
      <div className="opacity-20 pointer-events-none select-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-border" />
            <div>
              <div className="h-3 bg-border rounded-full w-24 mb-1.5" />
              <div className="h-3 bg-border rounded-full w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-card border border-border-light rounded-2xl p-6 text-center shadow-lg max-w-xs mx-4">
          <div className="w-10 h-10 rounded-full bg-border-light flex items-center justify-center mx-auto mb-3">
            <span className="text-lg">🔒</span>
          </div>
          <h3 className="text-sm font-bold text-text-primary mb-1">create an account to unlock</h3>
          <ul className="text-xs text-text-secondary mb-4 text-left space-y-1">
            <li>• see how your friends voted</li>
            <li>• predict their answers</li>
            <li>• friend knowledge score</li>
          </ul>
          <Link href="/signin" className="block w-full py-2.5 bg-dark text-white text-sm font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors mb-2">
            create free account
          </Link>
          <Link href="/signin" className="text-xs text-text-muted hover:text-text-secondary">
            already have one? sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
