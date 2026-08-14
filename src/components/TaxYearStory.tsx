import type { TaxFilingResult } from "@/lib/taxCenter";

// The colorful part of a year's Tax Center card: who earned what, what got
// paid in, and what filing together saved. Reuses the same violet/teal pair
// Bills already uses to tell two categories apart (fico vs reg) rather than
// inventing a new palette.
const JAMIE_COLOR = "var(--fico)";
const CHRIS_COLOR = "var(--reg)";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function TaxYearStory({ result }: { result: TaxFilingResult }) {
  const { jamieIncome, chrisIncome, taxesPaid, mfjTax, singleTax } = result;
  const hasIncome = jamieIncome != null && chrisIncome != null;
  const savings = mfjTax != null && singleTax != null ? singleTax - mfjTax : null;

  if (!hasIncome && taxesPaid == null) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {hasIncome && <IncomeBars jamieIncome={jamieIncome!} chrisIncome={chrisIncome!} />}

      <div className="grid grid-cols-2 gap-2">
        {taxesPaid != null && (
          <StatTile label="Taxes paid" value={money(taxesPaid)} />
        )}
        {savings != null && (
          <StatTile
            label="Filing jointly saved"
            value={savings >= 0 ? money(savings) : `-${money(-savings)}`}
            tone={savings >= 0 ? "good" : undefined}
          />
        )}
      </div>

      {savings != null && (
        <p className="text-[11px] text-faint">
          Estimated: married filing jointly vs. two single returns, using
          Jamie&apos;s income and Chris&apos;s books for {result.year}. Jamie&apos;s
          side only has her income on file, so treat this as a ballpark, not
          the exact number a return would show.
        </p>
      )}
    </div>
  );
}

function IncomeBars({ jamieIncome, chrisIncome }: { jamieIncome: number; chrisIncome: number }) {
  const total = Math.max(jamieIncome, 1) + Math.max(chrisIncome, 1);
  const jamiePct = (Math.max(jamieIncome, 0) / total) * 100;
  const chrisPct = (Math.max(chrisIncome, 0) / total) * 100;

  return (
    <div className="space-y-1.5">
      <IncomeBar label="Jamie earned" value={jamieIncome} pct={jamiePct} color={JAMIE_COLOR} />
      <IncomeBar label="Chris earned" value={chrisIncome} pct={chrisPct} color={CHRIS_COLOR} />
    </div>
  );
}

function IncomeBar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="font-medium text-foreground">{money(value)}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-tint">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(pct, 3)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good";
}) {
  return (
    <div className="rounded-xl bg-tint p-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className="mt-0.5 text-[15px] font-semibold"
        style={{ color: tone === "good" ? "var(--good)" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}
