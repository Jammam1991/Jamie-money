"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { unlockVault } from "@/lib/actions";

// The second lock. Being signed in gets you everywhere else in the app; this
// one screen asks again before it shows anybody's logins. Chris re-types his
// password, Jamie re-taps his PIN — `pin` only changes the wording and the
// keyboard, since the server already knows which is which from the role.
export default function VaultUnlock({
  minutes,
  pin = false,
}: {
  minutes: number;
  pin?: boolean;
}) {
  const [state, action, pending] = useActionState(unlockVault, null);

  return (
    <Card>
      <form action={action} className="space-y-3">
        <div>
          <p className="text-[15px] font-medium">
            {pin ? "Tap your PIN in again" : "Type your password again"}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            The same one you signed in with. It opens the password book for{" "}
            {minutes} minutes, then it locks itself.
          </p>
        </div>
        <input
          id="vault-password"
          name="password"
          type="password"
          inputMode={pin ? "numeric" : "text"}
          autoComplete="current-password"
          autoFocus
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[15px] outline-none focus:border-[var(--muted)]"
          placeholder={pin ? "PIN" : "Password"}
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
