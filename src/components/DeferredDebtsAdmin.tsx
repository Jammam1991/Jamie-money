"use client";

import { useState, useTransition } from "react";
import { PauseCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import { setDebtDeferred } from "@/lib/actions";

// ── Which debts aren't being paid right now ──────────────────────────────────
// One row per debt with a switch. On = the payment is deferred, so it drops out
// of "what you pay now" on the Debt page.
//
// Deferring changes the monthly figure and nothing else. The balance is still
// owed, still counted in the total, still in every breakdown — this is about
// what leaves the account each month, not about what's owed. The wording says
// so, because a switch that looked like it made a debt go away would be a bad
// thing to put in front of anyone.
export default function DeferredDebtsAdmin({
  debts,
  initialDeferred,
}: {
  debts: Debt[];
  initialDeferred: string[];
}) {
  const [deferred, setDeferred] = useState<string[]>(initialDeferred);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    const now = !deferred.includes(id);
    const before = deferred;
    // Flip it straight away, put it back if the save fails.
    setDeferred(now ? [...deferred, id] : deferred.filter((d) => d !== id));
    setError(null);
    startTransition(async () => {
      const res = await setDebtDeferred(id, now);
      if (!res.ok) {
        setDeferred(before);
        setError(res.error ?? "Couldn't save that.");
      }
    });
  };

  // Biggest payment first — that's the one worth knowing is on hold.
  const rows = [...debts].sort((a, b) => b.minPayment - a.minPayment);
  const paused = rows.filter((d) => deferred.includes(d.id));
  const pausedMonthly = paused.reduce((sum, d) => sum + d.minPayment, 0);

  return (
    <div>
      <h2 className="mb-2 text-[15px] font-medium">Deferred payments</h2>
      <p className="mb-3 text-[13px] text-muted">
        Switch on any debt that isn&apos;t being paid right now. It stays owed
        and stays in every total — the only thing this changes is the monthly
        figure, so the Debt page can show what actually goes out each month next
        to what will once these start.
      </p>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            No debts yet. They arrive from Money App, or you can add one on the
            Debt page.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((d) => {
            const off = deferred.includes(d.id);
            return (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                    <span className="truncate">{d.name}</span>
                    {off && (
                      <span className="flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[11px] font-normal text-muted">
                        <PauseCircle size={11} />
                        Deferred
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {money(d.balance)} owed · {money(d.minPayment)}/mo
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={off}
                  aria-label={`Mark ${d.name} as deferred`}
                  disabled={pending}
                  onClick={() => toggle(d.id)}
                  className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
                  style={{ backgroundColor: off ? "var(--warn)" : "var(--tint)" }}
                >
                  <span
                    className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{ left: off ? "1.75rem" : "0.25rem" }}
                  />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      <p className="mt-2 text-center text-[13px] text-muted">
        {paused.length === 0
          ? "Nothing deferred — the Debt page shows one monthly figure."
          : `${paused.length} deferred, holding back ${money(pausedMonthly)}/mo.`}
      </p>
    </div>
  );
}
