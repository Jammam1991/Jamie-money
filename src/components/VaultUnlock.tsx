"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { unlockVault } from "@/lib/actions";

// The second lock. Being signed in gets you everywhere else in the app; this
// one screen asks for the password again before it shows anybody's logins.
export default function VaultUnlock({ minutes }: { minutes: number }) {
  const [state, action, pending] = useActionState(unlockVault, null);

  return (
    <Card>
      <form action={action} className="space-y-3">
        <div>
          <p className="text-[15px] font-medium">Type your password again</p>
          <p className="mt-1 text-[13px] text-muted">
            The same one you signed in with. It opens the password book for{" "}
            {minutes} minutes, then it locks itself.
          </p>
        </div>
        <input
          id="vault-password"
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
          {pending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </Card>
  );
}
