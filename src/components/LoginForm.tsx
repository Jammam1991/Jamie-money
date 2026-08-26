"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { login } from "@/lib/actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Two ways in, one form. Jamie taps four digits — no keyboard, no password to
// remember, and it sends itself the moment the last dot fills. Chris taps
// "I'm Chris" and gets an ordinary password box; both post the same field, so
// the server doesn't need to care which one was used.
export default function LoginForm({
  pinLength,
  pinReady,
}: {
  pinLength: number;
  pinReady: boolean;
}) {
  const [state, action, pending] = useActionState(login, null);
  const [pin, setPin] = useState("");
  const [manager, setManager] = useState(false);

  // While it's being checked the digits are already gone, so show a full row.
  const filled = pending ? pinLength : pin.length;

  // The last digit is the submit button: the PIN goes off to be checked and
  // the box empties in the same breath, so a wrong one leaves a clean row to
  // try again on rather than four backspaces. The dots stay filled while it's
  // in flight — `pending` stands in for the digits that were just sent.
  function push(digit: string) {
    if (pending) return;
    const next = pin + digit;
    if (next.length > pinLength) return;
    if (next.length < pinLength) {
      setPin(next);
      return;
    }
    setPin("");
    const data = new FormData();
    data.set("password", next);
    startTransition(() => action(data));
  }

  // On a laptop the number row should just work — the pad is for thumbs.
  useEffect(() => {
    if (manager) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) push(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <form action={action} className="space-y-4">
      {manager ? (
        <div className="space-y-3">
          <label className="block text-[13px] text-muted" htmlFor="password">
            Enter your password to continue
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[15px] outline-none focus:border-[var(--muted)]"
            placeholder="Password"
          />
          {state?.error && <p className="text-[13px] text-warn">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--good)" }}
          >
            <Lock size={16} />
            {pending ? "Checking…" : "Log in"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-[13px] text-muted">
            {pinReady ? "Enter your PIN" : "No PIN set yet — ask Chris for one"}
          </p>

          {/* One dot per digit: enough feedback to know a tap landed, without
              putting the PIN itself on screen in front of whoever's nearby. */}
          <div className="flex justify-center gap-3" aria-hidden="true">
            {Array.from({ length: pinLength }).map((_, i) => (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-full border transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: i < filled ? "var(--good)" : "transparent",
                }}
              />
            ))}
          </div>

          <p className="min-h-[18px] text-center text-[13px] text-warn">
            {pending ? "" : state?.error}
          </p>

          <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
            {KEYS.map((k) => (
              <PadKey key={k} label={k} disabled={pending} onPress={() => push(k)} />
            ))}
            <span />
            <PadKey label="0" disabled={pending} onPress={() => push("0")} />
            <PadKey
              label={<Delete size={18} />}
              srLabel="Delete"
              muted
              disabled={pending || pin.length === 0}
              onPress={() => setPin((p) => p.slice(0, -1))}
            />
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setPin("");
                setManager(true);
              }}
              className="text-[13px] text-muted underline underline-offset-2"
            >
              I&apos;m Chris — use a password
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function PadKey({
  label,
  srLabel,
  onPress,
  disabled,
  muted,
}: {
  label: React.ReactNode;
  srLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={srLabel}
      className={`flex h-14 items-center justify-center rounded-xl border border-border text-[20px] font-medium tabular-nums active:opacity-60 disabled:opacity-30 ${
        muted ? "text-muted" : "bg-card"
      }`}
    >
      {label}
    </button>
  );
}
