"use client";

import { useState, useTransition } from "react";
import { PauseCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import type { ExtraPayment } from "@/lib/monthlyExtras";
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
  extras,
  initialDeferred,
}: {
  debts: Debt[];
  // The two monthly payments with no row in the debts table — the divorce
  // settlement and Jamie's share of the gym debt. Both are money that leaves
  // every month, so both belong on this list.
  extras: ExtraPayment[];
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
  const rows = [
    ...debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      monthly: d.minPayment,
      worked: false,
    })),
    ...extras.map((e) => ({ ...e, worked: true })),
  ].sort((a, b) => b.monthly - a.monthly);
  const paused = rows.filter((r) => deferred.includes(r.id));
  const pausedMonthly = paused.reduce((sum, r) => sum + r.monthly, 0);

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
                    {money(d.balance)} owed · {money(d.monthly)}/mo
                    {/* Not a row in the debts table — worked out from the
                        settlement terms or the gym split. Worth saying, or it
                        looks like a debt that's gone missing from the list. */}
                    {d.worked && " · worked out, not a debt row"}
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
