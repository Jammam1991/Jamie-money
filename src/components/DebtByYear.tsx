"use client";

import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import type { DebtTransaction } from "@/lib/store";

// How far back the year list goes. Any year with nothing logged says
// "Coming soon" instead of pretending we know the numbers.
const FIRST_YEAR = 2023;

// What debt at 15% costs to keep up with each month: one month of interest
// (15% ÷ 12) plus 1% of the balance — the way a credit card sets its minimum.
// It's a straight line, so every $1,000 borrowed adds about $23 a month.
const MONTHLY_RATE = 0.15 / 12 + 0.01;

export function monthlyAt15(balance: number): number {
  return Math.max(0, balance) * MONTHLY_RATE;
}

type YearRow = {
  year: number;
  added: number;
  owed: number; // what was owed at the end of that year
  known: boolean; // false -> "Coming soon"
};

// Build one row per year, newest first. We know today's total, so we walk
// backwards: last year's total is this year's total minus what got added.
function buildRows(
  txs: DebtTransaction[],
  total: number,
  currentYear: number
): YearRow[] {
  const added = new Map<number, number>();
  for (const tx of txs) {
    const year = Number(tx.txDate.slice(0, 4));
    if (!year) continue;
    added.set(year, (added.get(year) ?? 0) + tx.amount);
  }

  const rows: YearRow[] = [];
  let owed = total;
  for (let year = currentYear; year >= FIRST_YEAR; year--) {
    const thisYear = added.get(year) ?? 0;
    rows.push({ year, added: thisYear, owed, known: added.has(year) });
    owed -= thisYear;
  }
  return rows;
}

export default function DebtByYear({
  transactions,
  total,
  currentYear,
}: {
  transactions: DebtTransaction[];
  total: number;
  currentYear: number;
}) {
  const rows = buildRows(transactions, total, currentYear);
  const maxOwed = Math.max(...rows.map((r) => r.owed), 1);
  const thisYear = rows[0];
  const addedThisYear = thisYear?.known ? thisYear.added : 0;

  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <CalendarDays size={15} />
        Debt by year
      </p>

      {addedThisYear > 0 && (
        <p className="mt-2 text-[15px]">
          You added <span className="font-medium">{money(addedThisYear)}</span> more
          debt in {currentYear} so far. That&apos;s about{" "}
          <span className="font-medium text-warn">
            {money(monthlyAt15(addedThisYear))} more a month
          </span>{" "}
          than you were paying at the end of {currentYear - 1}.
        </p>
      )}

      <div className="mt-3 divide-y divide-border border-t border-border">
        {rows.map((r) => (
          <div key={r.year} className="py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-medium">
                {r.year}
                {r.year === currentYear ? " so far" : ""}
              </span>
              {r.known ? (
                <span className="text-[15px] text-warn">
                  +{money(r.added)} added
                </span>
              ) : (
                <span className="text-[13px] text-muted">Coming soon</span>
              )}
            </div>

            {r.known && (
              <>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-tint">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.owed / maxOwed) * 100}%`,
                      background: "var(--warn)",
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  Owed {money(r.owed)} · about{" "}
                  {money(monthlyAt15(r.owed))}/month to keep up
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted">
        &quot;To keep up&quot; means one month of interest at 15% plus 1% of what
        you owe — how a credit card works out a minimum payment. Every extra
        $1,000 you borrow adds about $23 a month, forever, until it&apos;s paid
        off.
      </p>
    </Card>
  );
}
