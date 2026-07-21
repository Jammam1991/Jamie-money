"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { login } from "@/lib/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="space-y-3">
      <label className="block text-[13px] text-muted" htmlFor="password">
        Enter your password to make changes
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
    </form>
  );
}
