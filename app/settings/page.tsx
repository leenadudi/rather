"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setUsername, setAvatarColor, deleteAccount } from "@/lib/server/account";
import { resolveAvatarColor, hueToHex, hexToHue } from "@/lib/avatar";
import { Avatar } from "@/components/Avatar";
import { USERNAME_EMAIL_DOMAIN } from "@/lib/usernameAuth";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsernameState] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [hasRealEmail, setHasRealEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setHasRealEmail(!!user.email && !user.email.endsWith(`@${USERNAME_EMAIL_DOMAIN}`));
      const { data: u } = await supabase.from("users").select("username, avatar_color").eq("id", user.id).single();
      if (u) { setUsernameState(u.username ?? ""); setColor(u.avatar_color ?? null); }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <main className="min-h-screen bg-background flex items-center justify-center"><p className="text-text-muted text-sm">loading…</p></main>;
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-3">settings</h1>
          <p className="text-sm text-text-secondary mb-6">create an account to manage your profile and preferences.</p>
          <Link href="/signin" className="block w-full py-3 bg-dark text-white font-semibold rounded-xl text-center hover:bg-text-secondary transition-colors">
            create free account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-8">settings</h1>
      <div className="space-y-8">
        <ColorSection username={username} color={color} onChange={setColor} />
        <UsernameSection current={username} onSaved={setUsernameState} />
        <EmailSection hasRealEmail={hasRealEmail} />
        <DeleteSection
          onDeleted={async () => { await supabase.auth.signOut(); router.replace("/"); }}
        />
      </div>
    </main>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border-light rounded-2xl p-5">
      <h2 className="text-sm font-bold text-text-primary mb-1">{title}</h2>
      {desc && <p className="text-xs text-text-muted mb-4">{desc}</p>}
      {children}
    </section>
  );
}

const HUE_GRADIENT =
  "linear-gradient(to right, #ff5b5b 0%, #ffd24d 17%, #6ee06e 33%, #4dd6d6 50%, #5b8cff 67%, #c46bff 83%, #ff5b5b 100%)";

function ColorSection({ username, color, onChange }: { username: string; color: string | null; onChange: (c: string) => void }) {
  const [saving, setSaving] = useState(false);
  // live color shown while dragging; persisted on release
  const [draft, setDraft] = useState(() => resolveAvatarColor(color, username));
  const [hue, setHue] = useState(() => hexToHue(resolveAvatarColor(color, username)));

  function preview(h: number) {
    setHue(h);
    setDraft(hueToHex(h));
  }

  async function commit() {
    if (saving) return;
    setSaving(true);
    const prev = color;
    onChange(draft); // optimistic (updates the shared avatar elsewhere)
    const res = await setAvatarColor(draft);
    if (!res.ok) { onChange(prev ?? ""); setDraft(resolveAvatarColor(prev, username)); }
    setSaving(false);
  }

  return (
    <Section title="profile color" desc="drag the gradient to pick any color — your avatar is just this color, no initials.">
      <div className="flex items-center gap-4 mb-5">
        <Avatar seed={username} color={draft} size={48} />
        <div>
          <p className="text-sm text-text-secondary">{username}</p>
          <p className="text-xs text-text-muted font-mono">{draft}</p>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => preview(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        aria-label="profile color"
        className="hue-slider w-full h-3 rounded-full appearance-none cursor-pointer"
        style={{ background: HUE_GRADIENT }}
      />
    </Section>
  );
}

function UsernameSection({ current, onSaved }: { current: string; onSaved: (u: string) => void }) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    const u = value.trim().toLowerCase();
    if (u === current) return;
    setSaving(true);
    setMsg(null);
    const res = await setUsername(u);
    if (res.ok) { onSaved(res.data.username); setValue(res.data.username); setMsg({ kind: "ok", text: "username updated" }); }
    else setMsg({ kind: "err", text: res.error });
    setSaving(false);
  }

  return (
    <Section title="username" desc="how friends find you.">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setMsg(null); }}
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-text-primary focus:outline-none focus:border-text-secondary"
        />
        <button
          onClick={save}
          disabled={saving || value.trim().toLowerCase() === current}
          className="px-4 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-text-secondary transition-colors"
        >
          {saving ? "…" : "save"}
        </button>
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.kind === "ok" ? "text-text-muted" : "text-error"}`}>{msg.text}</p>}
    </Section>
  );
}

function EmailSection({ hasRealEmail }: { hasRealEmail: boolean }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (hasRealEmail) {
    return (
      <Section title="recovery email" desc="an email is attached to your account for recovery.">
        <p className="text-sm text-text-secondary">✓ recovery email is set.</p>
      </Section>
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    if (error) setMsg({ kind: "err", text: error.message });
    else setMsg({ kind: "ok", text: "check your inbox to confirm the email." });
    setSaving(false);
  }

  return (
    <Section title="recovery email" desc="optional — add an email so you can recover this account or sign in on another device.">
      <form onSubmit={add} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); setMsg(null); }}
          placeholder="you@example.com"
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary"
        />
        <button type="submit" disabled={saving} className="px-4 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-text-secondary transition-colors">
          {saving ? "…" : "add"}
        </button>
      </form>
      {msg && <p className={`text-xs mt-2 ${msg.kind === "ok" ? "text-text-muted" : "text-error"}`}>{msg.text}</p>}
    </Section>
  );
}

function DeleteSection({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function doDelete() {
    setBusy(true);
    setErr("");
    const res = await deleteAccount();
    if (res.ok) { await onDeleted(); return; }
    setErr(res.error);
    setBusy(false);
  }

  return (
    <Section title="delete account" desc="permanently removes your account, profile, and friends. your votes stay but are no longer linked to you.">
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="text-sm font-semibold text-error hover:underline">
          delete my account
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-primary">are you sure?</span>
          <button onClick={doDelete} disabled={busy} className="px-3 py-1.5 bg-error text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {busy ? "deleting…" : "yes, delete"}
          </button>
          <button onClick={() => setConfirming(false)} disabled={busy} className="text-sm text-text-muted hover:text-text-secondary">
            cancel
          </button>
        </div>
      )}
      {err && <p className="text-xs text-error mt-2">{err}</p>}
    </Section>
  );
}
