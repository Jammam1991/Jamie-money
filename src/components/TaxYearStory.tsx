import type { TaxBreakdown, TaxFilingResult, TaxLine, TaxRefund } from "@/lib/taxCenter";

// One year of taxes told top to bottom: how it was filed, where the money came
// from, what came off before tax, what the bill worked out to, and where the
// refund went. Built for Jamie rather than for an accountant — every section
// leads with a plain sentence and the numbers back it up.
//
// Jamie keeps violet and Chris keeps teal throughout, the same pair Bills uses
// to tell two categories apart, so the colors mean the same thing on every
// section instead of being decoration.
const JAMIE = "var(--fico)";
const JAMIE_BG = "var(--fico-bg)";
const CHRIS = "var(--reg)";
const CHRIS_BG = "var(--reg-bg)";

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function TaxYearStory({ result }: { result: TaxFilingResult }) {
  const { filedAs, breakdown, refunds, taxesPaid, mfjTax, singleTax } = result;
  const savings = mfjTax != null && singleTax != null ? singleTax - mfjTax : null;
  const refundTotal = refunds.reduce((sum, r) => sum + r.amount, 0);

  const hasAnything =
    filedAs || breakdown || refunds.length > 0 || taxesPaid != null || savings != null;
  if (!hasAnything) {
    return (
      <p className="mt-3 text-[14px] text-muted">
        Nothing has been filled in for {result.year} yet.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {refunds.length > 0 && <RefundHero total={refundTotal} year={result.year} />}
      {filedAs && <FiledAsCard filedAs={filedAs} />}
      {breakdown && <IncomeSection breakdown={breakdown} />}
      {breakdown && <DeductionSection breakdown={breakdown} />}
      {breakdown && <TaxSection breakdown={breakdown} taxesPaid={taxesPaid} />}
      {taxesPaid != null && !breakdown && <TaxesPaidOnly amount={taxesPaid} />}
      {refunds.length > 0 && <RefundSection refunds={refunds} total={refundTotal} />}
      {savings != null && <SavingsCard savings={savings} year={result.year} />}
      {breakdown && <SourceFootnote breakdown={breakdown} year={result.year} />}
    </div>
  );
}

// ── The headline ───────────────────────────────────────────────────────────

function RefundHero({ total, year }: { total: number; year: number }) {
  return (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: "var(--good-bg)", border: "1px solid var(--good)" }}
    >
      <p className="text-[13px] font-medium" style={{ color: "var(--good)" }}>
        🎉 Money came back in {year}
      </p>
      <p className="mt-1 text-3xl font-bold" style={{ color: "var(--good)" }}>
        {money(total)}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Too much was paid in during the year, so the difference came back.
      </p>
    </div>
  );
}

// ── How it was filed ───────────────────────────────────────────────────────

function FiledAsCard({ filedAs }: { filedAs: NonNullable<TaxFilingResult["filedAs"]> }) {
  return (
    <Section emoji="📋" title="How the taxes were filed">
      <div
        className="rounded-xl p-3"
        style={{ background: filedAs.married ? JAMIE_BG : "var(--tint)" }}
      >
        <p className="text-[15px] font-semibold" style={{ color: filedAs.married ? JAMIE : "var(--text)" }}>
          {filedAs.label}
        </p>
        <p className="mt-1 text-[13px] text-muted">{filedAs.blurb}</p>
      </div>
      {!filedAs.certain && (
        <p className="mt-2 text-[11px] text-faint">
          Based on whether you were married on December 31 that year — the one
          date the tax office looks at. It isn&apos;t copied off the return itself.
        </p>
      )}
    </Section>
  );
}

// ── Where the money came from ──────────────────────────────────────────────

function IncomeSection({ breakdown }: { breakdown: TaxBreakdown }) {
  const { income } = breakdown;
  const total = income.total;
  if (total <= 0) return null;

  const jamiePct = (Math.max(income.jamieTotal, 0) / total) * 100;
  const chrisPct = (Math.max(income.chrisTotal, 0) / total) * 100;

  return (
    <Section emoji="💰" title="Where the money came from">
      <p className="text-[13px] text-muted">
        {money(total)} came in altogether.
      </p>

      {/* One bar for the household, split by who earned what. */}
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-tint">
        <div style={{ width: `${jamiePct}%`, background: JAMIE }} />
        <div style={{ width: `${chrisPct}%`, background: CHRIS }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <Key color={JAMIE} label="Jamie" value={money(income.jamieTotal)} />
        <Key color={CHRIS} label="Chris" value={money(income.chrisTotal)} />
      </div>

      <div className="mt-3 space-y-3">
        <PersonLines
          who="Jamie"
          color={JAMIE}
          bg={JAMIE_BG}
          lines={income.jamie}
          total={income.jamieTotal}
        />
        <PersonLines
          who="Chris"
          color={CHRIS}
          bg={CHRIS_BG}
          lines={income.chris}
          total={income.chrisTotal}
        />
      </div>
    </Section>
  );
}

function PersonLines({
  who,
  color,
  bg,
  lines,
  total,
}: {
  who: string;
  color: string;
  bg: string;
  lines: TaxLine[];
  total: number;
}) {
  if (lines.length === 0 && total <= 0) return null;

  return (
    <div className="rounded-xl p-3" style={{ background: bg }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold" style={{ color }}>
          {who}
        </p>
        <p className="text-[13px] font-semibold" style={{ color }}>
          {money(total)}
        </p>
      </div>
      {lines.length > 0 && (
        <div className="mt-2 space-y-1">
          {lines.map((l) => (
            <Row key={l.label} label={l.label} amount={l.amount} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── What came off before tax ───────────────────────────────────────────────

function DeductionSection({ breakdown }: { breakdown: TaxBreakdown }) {
  const { adjustments, deduction, agi, taxableIncome } = breakdown;
  const takenOff = adjustments.total + deduction.used + deduction.qbi;
  if (takenOff <= 0) return null;

  return (
    <Section emoji="✂️" title="What came off before tax">
      <p className="text-[13px] text-muted">
        Not every dollar earned gets taxed. {money(takenOff)} came off first.
      </p>

      <div className="mt-3 space-y-2">
        {adjustments.lines.length > 0 && (
          <Group title="Money set aside" lines={adjustments.lines} total={adjustments.total} />
        )}
        <Group
          title={deduction.usedItemized ? "Itemized deductions" : "The standard deduction"}
          lines={deduction.lines}
          total={deduction.used}
          note={
            deduction.usedItemized
              ? "Adding these up beat the flat amount everyone gets, so these were used instead."
              : "A flat amount everyone gets, no receipts needed. It beat adding up the individual write-offs."
          }
        />
        {deduction.extras.length > 0 && (
          <Group
            title="Extra write-offs"
            lines={deduction.extras}
            total={deduction.extras.reduce((s, l) => s + l.amount, 0)}
          />
        )}
        {deduction.qbi > 0 && (
          <Group
            title="Small business deduction"
            lines={[{ label: "Business income discount", amount: deduction.qbi }]}
            total={deduction.qbi}
            note="A slice of business profit that simply isn't taxed."
          />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label="Counted as income" value={money(agi)} />
        <Tile label="Actually taxed" value={money(taxableIncome)} tone="good" />
      </div>
    </Section>
  );
}

// ── The bill ───────────────────────────────────────────────────────────────

function TaxSection({
  breakdown,
  taxesPaid,
}: {
  breakdown: TaxBreakdown;
  taxesPaid: number | null;
}) {
  const { tax, paidIn, effectiveRate } = breakdown;
  const perHundred = Math.round(Math.max(effectiveRate, 0) * 100);

  return (
    <Section emoji="🧾" title="What the tax came to">
      {perHundred > 0 && (
        <p className="text-[13px] text-muted">
          Out of every $100 that came in, about{" "}
          <span className="font-semibold text-foreground">${perHundred}</span> went to tax.
        </p>
      )}

      {tax.lines.length > 0 && (
        <div className="mt-3 space-y-1">
          {tax.lines.map((l) => (
            <Row key={l.label} label={l.label} amount={l.amount} />
          ))}
        </div>
      )}

      {tax.credits > 0 && (
        <div className="mt-1 space-y-1">
          <Row label="Credits knocked off" amount={-tax.credits} tone="good" />
        </div>
      )}

      <div className="mt-3 space-y-1 border-t border-border pt-2">
        <Row label="Total tax for the year" amount={tax.total} strong />
        <Row label="Chris paid through the year at the bank" amount={paidIn} />
      </div>

      {taxesPaid != null && (
        <div className="mt-3 rounded-xl p-3" style={{ background: "var(--warn-bg)" }}>
          <p className="text-[12px]" style={{ color: "var(--warn)" }}>
            Actually paid, from the filed return
          </p>
          <p className="text-[18px] font-bold" style={{ color: "var(--warn)" }}>
            {money(taxesPaid)}
          </p>
        </div>
      )}
    </Section>
  );
}

function TaxesPaidOnly({ amount }: { amount: number }) {
  return (
    <Section emoji="🧾" title="What the tax came to">
      <div className="rounded-xl p-3" style={{ background: "var(--warn-bg)" }}>
        <p className="text-[12px]" style={{ color: "var(--warn)" }}>
          Paid in tax this year
        </p>
        <p className="text-[18px] font-bold" style={{ color: "var(--warn)" }}>
          {money(amount)}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        The full breakdown of how this was worked out isn&apos;t saved for this
        year in the Money App.
      </p>
    </Section>
  );
}

// ── The refund, and where it went ──────────────────────────────────────────

function RefundSection({ refunds, total }: { refunds: TaxRefund[]; total: number }) {
  return (
    <Section emoji="💸" title="Where the refund went">
      <p className="text-[13px] text-muted">
        {money(total)} came back
        {refunds.length > 1 ? ` across ${refunds.length} refunds` : ""}. Here&apos;s
        what happened to it.
      </p>

      <div className="mt-3 space-y-3">
        {refunds.map((refund, refundIndex) => {
          const allocated = refund.allocations.reduce((s, a) => s + a.amount, 0);
          const leftover = refund.amount - allocated;

          return (
            // Keyed by position: nothing stops two refunds sharing a type
            // ("Federal" twice for an amended return), and the list is a
            // fixed snapshot per year, so the index is stable.
            <div key={refundIndex} className="rounded-xl border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-semibold">{refund.type}</p>
                <p className="text-[14px] font-semibold" style={{ color: "var(--good)" }}>
                  {money(refund.amount)}
                </p>
              </div>

              {refund.allocations.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {refund.allocations.map((a, i) => {
                    const share = refund.amount > 0 ? (a.amount / refund.amount) * 100 : 0;
                    return (
                      <div key={`${a.destination}-${i}`}>
                        <div className="flex items-baseline justify-between gap-2 text-[13px]">
                          <span className="font-medium">→ {a.destination}</span>
                          <span className="font-medium">{money(a.amount)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-tint">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(share, 2)}%`,
                              background: "var(--good)",
                            }}
                          />
                        </div>
                        {a.description && (
                          <p className="mt-1 text-[12px] text-muted">{a.description}</p>
                        )}
                      </div>
                    );
                  })}

                  {Math.round(leftover) > 0 && (
                    <p className="text-[12px] text-faint">
                      {money(leftover)}
                      {" of this hasn't been assigned anywhere yet."}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-faint">
                  Where this went hasn&apos;t been filled in yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── Filing together ────────────────────────────────────────────────────────

function SavingsCard({ savings, year }: { savings: number; year: number }) {
  const good = savings >= 0;
  return (
    <Section emoji={good ? "💞" : "🤔"} title="Filing together">
      <div
        className="rounded-xl p-3"
        style={{ background: good ? "var(--good-bg)" : "var(--warn-bg)" }}
      >
        <p className="text-[13px]" style={{ color: good ? "var(--good)" : "var(--warn)" }}>
          {good ? "Filing jointly saved" : "Filing jointly cost an extra"}
        </p>
        <p
          className="text-2xl font-bold"
          style={{ color: good ? "var(--good)" : "var(--warn)" }}
        >
          {money(Math.abs(savings))}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        One joint return in {year}
        {" compared against two separate ones. A rough comparison — only Jamie's income is on file, not any write-offs of her own."}
      </p>
    </Section>
  );
}

/**
 * Says where the year's figures came from, because "these are the real filed
 * numbers" and "this is our best reconstruction" should never look alike on a
 * page about tax.
 */
function SourceFootnote({ breakdown, year }: { breakdown: TaxBreakdown; year: number }) {
  if (breakdown.source === "transcript") {
    return (
      <div
        className="rounded-xl p-3"
        style={{ background: "var(--good-bg)", border: "1px solid var(--good)" }}
      >
        <p className="text-[12px] font-semibold" style={{ color: "var(--good)" }}>
          ✅ These are the real filed numbers
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Taken from the official IRS record of the {year} return — the return
          as it was actually processed, not a reconstruction.
          {breakdown.federalOnly
            ? " That record covers federal tax only, so California tax isn't included above."
            : ""}
        </p>
      </div>
    );
  }

  return (
    <p className="px-1 text-[11px] text-faint">
      {breakdown.source === "baseline"
        ? `The breakdown above is rebuilt from the numbers Chris saved in the Money App for ${year}.`
        : `The breakdown above is worked out from Chris's ${year} books.`}
      {" It isn't copied line by line off the filed return, so treat it as the shape of the year rather than exact figures. The refund and the tax actually paid are the real numbers."}
    </p>
  );
}

// ── Small pieces ───────────────────────────────────────────────────────────

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[15px] font-semibold">
        <span className="mr-1.5">{emoji}</span>
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Group({
  title,
  lines,
  total,
  note,
}: {
  title: string;
  lines: TaxLine[];
  total: number;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-tint p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="text-[13px] font-semibold">{money(total)}</p>
      </div>
      {lines.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {lines.map((l, i) => (
            <Row key={`${l.label}-${i}`} label={l.label} amount={l.amount} />
          ))}
        </div>
      )}
      {note && <p className="mt-1.5 text-[11px] text-faint">{note}</p>}
    </div>
  );
}

function Row({
  label,
  amount,
  strong,
  tone,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  tone?: "good";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className={strong ? "font-semibold" : "text-muted"}>{label}</span>
      <span
        className={strong ? "font-semibold" : "font-medium"}
        style={tone === "good" ? { color: "var(--good)" } : undefined}
      >
        {money(amount)}
      </span>
    </div>
  );
}

function Tile({
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

function Key({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-medium">{label}</span>
      <span className="text-muted">{value}</span>
    </span>
  );
}
