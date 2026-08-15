import Link from "next/link";
import type { TaxFilingResult } from "@/lib/taxCenter";

// Every year side by side, so the run of years reads as one story rather than
// as separate screens: how much came in, how much of it went to tax, and what
// came back. Bars share one scale across all years — that's the whole point,
// since a year only means much next to the ones either side of it.
//
// Each row is also the year picker. Tapping one opens that year in full below.

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Shorter money for cramped bar labels: $178,500 → $179k. */
function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return money(n);
}

export function TaxYearsOverview({
  results,
  selected,
}: {
  results: TaxFilingResult[];
  selected: number;
}) {
  const rows = results
    .map((r) => {
      const income = r.breakdown?.income.total ?? null;
      const tax = r.taxesPaid ?? r.breakdown?.tax.total ?? null;
      const refund = r.refunds.reduce((s, x) => s + x.amount, 0);
      return { year: r.year, income, tax, refund };
    })
    .sort((a, b) => a.year - b.year);

  if (rows.length < 2) return null;

  // One scale for every bar. Income is the tallest thing on the chart when we
  // know it; a year that only has a tax figure still has to sit somewhere
  // sensible against the others, so the scale takes the largest of either.
  const ceiling = Math.max(
    ...rows.map((r) => Math.max(r.income ?? 0, r.tax ?? 0)),
    1
  );

  const anyIncome = rows.some((r) => r.income != null);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[15px] font-semibold">
        <span className="mr-1.5">📈</span>
        Year by year
      </p>
      <p className="mt-1 text-[13px] text-muted">
        {anyIncome
          ? "What came in, how much of it went to tax, and what came back."
          : "What went to tax each year, and what came back."}
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((r) => {
          const isSelected = r.year === selected;
          const incomePct = r.income != null ? (r.income / ceiling) * 100 : 0;
          const taxPct = r.tax != null ? (r.tax / ceiling) * 100 : 0;

          return (
            <Link
              key={r.year}
              href={`/tax-center?year=${r.year}`}
              scroll={false}
              className="block rounded-xl p-2.5 transition-colors"
              style={{
                background: isSelected ? "var(--tint)" : undefined,
                boxShadow: isSelected ? "inset 0 0 0 1px var(--border)" : undefined,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">{r.year}</span>
                {r.refund > 0 && (
                  <span className="text-[12px] font-semibold" style={{ color: "var(--good)" }}>
                    🎉 {money(r.refund)} back
                  </span>
                )}
              </div>

              {/* Income as the full bar, with the tax slice drawn over it. */}
              <div className="mt-1.5 space-y-1">
                {r.income != null && (
                  <BarLine
                    label="Came in"
                    value={compact(r.income)}
                    pct={incomePct}
                    color="var(--reg)"
                  />
                )}
                {r.tax != null && (
                  <BarLine
                    label="Went to tax"
                    value={compact(r.tax)}
                    pct={taxPct}
                    color="var(--warn)"
                  />
                )}
                {r.income == null && r.tax == null && (
                  <p className="text-[12px] text-faint">Nothing filled in yet.</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BarLine({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[72px] shrink-0 text-[11px] text-muted">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-tint">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(pct, 1.5)}%`, background: color }}
        />
      </span>
      <span className="w-[52px] shrink-0 text-right text-[11px] font-medium">{value}</span>
    </div>
  );
}
