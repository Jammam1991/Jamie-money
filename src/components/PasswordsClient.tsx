"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Copy, Check, Eye, EyeOff, ExternalLink, Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { lockVault, revealPassword } from "@/lib/actions";
import type { PasswordEntry } from "@/lib/passwords";

// How long a revealed password stays on screen before it puts itself away.
const HIDE_AFTER_SECONDS = 45;

interface Open {
  id: string;
  username: string;
  password: string;
  notes: string;
}

// The read-only list. What arrives with the page is names and websites only —
// no password is anywhere in this browser until Show is pressed, and then only
// that one, and only until the countdown runs out.
//
// One at a time on purpose: opening a second entry closes the first, so a phone
// handed to someone is never showing a screenful of logins.
export default function PasswordsClient({ entries }: { entries: PasswordEntry[] }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [left, setLeft] = useState(HIDE_AFTER_SECONDS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The countdown, and the tidy-up that goes with it. Leaving the page, or
  // letting the timer run out, both clear the secret out of memory. The clock
  // is set back to full in `show`, not here, so this only ever starts timers.
  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const end = setTimeout(() => setOpen(null), HIDE_AFTER_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(end);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const show = useCallback((id: string) => {
    setError(null);
    setOpen(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await revealPassword(id);
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLeft(HIDE_AFTER_SECONDS);
      setOpen({ id, username: res.username, password: res.password, notes: res.notes });
    });
  }, []);

  const copy = useCallback(async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy — press and hold to select it instead.");
    }
  }, []);

  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-[15px] text-muted">
          No logins saved yet. Chris adds them on the Settings screen.
        </p>
      </Card>
    );
  }

  // Grouped into folders, with anything unfiled last.
  const groups = new Map<string, PasswordEntry[]>();
  for (const e of entries) {
    const g = e.category?.trim() || "Everything else";
    const list = groups.get(g);
    if (list) list.push(e);
    else groups.set(g, [e]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "Everything else" ? 1 : b === "Everything else" ? -1 : a.localeCompare(b)
  );

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</div>
      )}

      {ordered.map(([group, rows]) => (
        <div key={group} className="space-y-2">
          <h2 className="text-[13px] font-medium text-muted">{group}</h2>
          <Card className="space-y-0 divide-y divide-border">
            {rows.map((e) => {
              const isOpen = open?.id === e.id;
              return (
                <div key={e.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{e.label}</div>
                      {e.url && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-blue-600 hover:underline"
                        >
                          <ExternalLink size={12} className="shrink-0" />
                          <span className="truncate">{prettyHost(e.url)}</span>
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => (isOpen ? setOpen(null) : show(e.id))}
                      disabled={busyId === e.id}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-medium hover:bg-tint disabled:opacity-50"
                    >
                      {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                      {busyId === e.id ? "Opening…" : isOpen ? "Hide" : "Show"}
                    </button>
                  </div>

                  {isOpen && open && (
                    <div className="mt-3 space-y-2 rounded-xl bg-tint p-3">
                      {open.username && (
                        <SecretRow
                          label="Username"
                          value={open.username}
                          copied={copied === `${e.id}-user`}
                          onCopy={() => copy(open.username, `${e.id}-user`)}
                        />
                      )}
                      <SecretRow
                        label="Password"
                        value={open.password}
                        copied={copied === `${e.id}-pass`}
                        onCopy={() => copy(open.password, `${e.id}-pass`)}
                      />
                      {open.notes && (
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted">Notes</div>
                          <p className="whitespace-pre-wrap text-[14px]">{open.notes}</p>
                        </div>
                      )}
                      <p className="text-[12px] text-muted">Hides itself in {left}s.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      ))}

      <form action={lockVault}>
        <button
          type="submit"
          className="flex items-center gap-1.5 text-[13px] text-muted hover:opacity-70"
        >
          <Lock size={13} />
          Lock the password book now
        </button>
      </form>
    </div>
  );
}

function SecretRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
        {/* Monospaced so an l and a 1 can't be mistaken for one another when
            it's being typed in somewhere else by hand. */}
        <div className="break-all font-mono text-[14px]">{value}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] hover:bg-tint"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// "https://www.chase.com/login" → "chase.com". Just the readable bit.
function prettyHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
