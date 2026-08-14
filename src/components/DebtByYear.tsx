"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Gift,
  Landmark,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import { yearColor, yearInk, yearTint } from "@/lib/debtColors";
import DebtGrowthChart from "@/components/DebtGrowthChart";
import BusinessPayMonth from "@/components/BusinessPayMonth";
import type { DebtSnapshotRow, DebtTransaction } from "@/lib/store";
import type { PayMonth } from "@/lib/gymPay";

// One card, one list of years. This used to be two — a "Debt by year" summary
// and a separate "Where the debt came from" drill-down — which meant scrolling
// past the same years twice to get from a total to the transactions behind it.
// The years are now the drill-down: tap one and it opens.

// How far back the year list goes when there's nothing to go on. The real
// starting point is the oldest transaction on record — this is only the
// fallback for an empty page, so it doesn't sit there showing a single year.
//
// It used to be a fixed 2023, from before the loans came across from Money
// App and that was genuinely as far back as anything went. Once years of
// history synced in, a hardcoded floor just hid most of it.
const FALLBACK_FIRST_YEAR = 2023;

// A year read off a YYYY-MM-DD string, or null if it isn't one. Read off the
// string rather than via `new Date()`, which would shift a January 1st charge
// into the year before depending on the timezone.
function yearOf(date: string): number | null {
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}

// What debt at 15% costs to keep up with each month: one month of interest
// (15% ÷ 12) plus 1% of the balance — the way a credit card sets its minimum.
// It's a straight line, so every $1,000 borrowed adds about $23 a month.
const MONTHLY_RATE = 0.15 / 12 + 0.01;

export function monthlyAt15(balance: number): number {
  return Math.max(0, balance) * MONTHLY_RATE;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";

type MonthGroup = { month: number; total: number; items: DebtTransaction[] };

// Where a year's "owed" figure comes from. `added` is always real — it's that
// year's transactions added up — but `owed` is only real for the years
// something actually recorded a balance, and worked backwards for the rest.
type Evidence = "statement" | "credit report" | "recorded";

type OwedSource =
  | { kind: "actual"; asOf: string; from: Evidence }
  | { kind: "estimated" };

// How strong a recorded balance is, read off the note Money App saved with it.
//
// A statement is the account itself telling us what was owed that day. A credit
// report is a bureau's copy, filed weeks later and missing anything the lender
// didn't report — close, but not the source. Anything else was typed in.
//
// Ranked, because a year can hold several records and the best one should win
// even when it isn't the latest.
const EVIDENCE_RANK: Record<Evidence, number> = {
  statement: 3,
  "credit report": 2,
  recorded: 1,
};

function evidenceOf(note: string | null): Evidence {
  const n = (note ?? "").toLowerCase();
  if (n.includes("statement")) return "statement";
  if (n.includes("cr update") || n.includes("credit report") || n.includes("bureau")) {
    return "credit report";
  }
  return "recorded";
}

type YearRow = {
  year: number;
  added: number;
  owed: number; // what was owed at the end of that year
  owedSource: OwedSource;
  known: boolean; // false -> "Coming soon"
  months: MonthGroup[];
  // Spent on Jamie that year but never treated as a loan. Deliberately kept
  // out of `added` and `owed` — it isn't debt and nothing here may add it to a
  // debt figure.
  spent: number;
  spentItems: DebtTransaction[];
};

// The last real balance recorded in each year.
//
// Applying a statement, and importing a credit report, both write one balance
// row per account on the date they cover — so adding up a single date's rows
// gives what was genuinely owed that day.
//
// Two things decide which date represents a year: how strong the evidence is,
// then how close to year end it falls. Strength comes first — a statement in
// June beats a credit report in December, because the bureau's copy can miss an
// account the lender never reported, and a missing account silently understates
// the total.
type Recorded = { total: number; asOf: string; from: Evidence };

function actualByYear(snapshots: DebtSnapshotRow[]): Map<number, Recorded> {
  // One running total per date, remembering the weakest evidence behind it —
  // a date is only as trustworthy as its shakiest row.
  const byDate = new Map<string, { total: number; from: Evidence }>();
  for (const s of snapshots) {
    const held = byDate.get(s.date);
    const from = evidenceOf(s.note);
    byDate.set(s.date, {
      total: (held?.total ?? 0) + s.balance,
      from:
        held && EVIDENCE_RANK[held.from] < EVIDENCE_RANK[from] ? held.from : from,
    });
  }

  const best = new Map<number, Recorded>();
  for (const [date, { total, from }] of byDate) {
    const year = yearOf(date);
    if (year === null) continue;
    const held = best.get(year);
    const better =
      !held ||
      EVIDENCE_RANK[from] > EVIDENCE_RANK[held.from] ||
      (EVIDENCE_RANK[from] === EVIDENCE_RANK[held.from] && date > held.asOf);
    if (better) best.set(year, { total, asOf: date, from });
  }
  return best;
}

// Build one row per year, newest first, each carrying the months inside it.
//
// We know today's total, so we walk backwards: last year's total is this
// year's total minus what got added. Where a year has a real recorded balance
// the walk re-anchors to it, so an error in the transaction history can't
// compound all the way down — the recent years stay tight and only the years
// past the last credit report drift.
function buildRows(
  txs: DebtTransaction[],
  spending: DebtTransaction[],
  snapshots: DebtSnapshotRow[],
  total: number,
  currentYear: number,
): YearRow[] {
  const actuals = actualByYear(snapshots);
  const spentByYear = new Map<number, DebtTransaction[]>();
  for (const s of spending) {
    const year = Number(s.txDate.slice(0, 4));
    if (!year) continue;
    spentByYear.set(year, [...(spentByYear.get(year) ?? []), s]);
  }

  // tx_date is stored as YYYY-MM-DD, so read the parts off the string instead
  // of `new Date()` — that would shift the day by the timezone.
  const byYear = new Map<number, Map<number, DebtTransaction[]>>();
  for (const tx of txs) {
    const [y, m] = tx.txDate.split("-").map(Number);
    if (!y || !m) continue;
    const months = byYear.get(y) ?? new Map<number, DebtTransaction[]>();
    months.set(m, [...(months.get(m) ?? []), tx]);
    byYear.set(y, months);
  }

  // Start from the oldest year anything happened in, so the list covers the
  // whole history rather than a fixed window that quietly cuts it off.
  const years = [...txs, ...spending]
    .map((t) => yearOf(t.txDate))
    .filter((y): y is number => y !== null && y <= currentYear);
  const firstYear = years.length > 0 ? Math.min(...years) : FALLBACK_FIRST_YEAR;

  const rows: YearRow[] = [];
  let owed = total;
  for (let year = currentYear; year >= firstYear; year--) {
    const months = byYear.get(year);
    const grouped: MonthGroup[] = [...(months?.entries() ?? [])]
      .sort((a, b) => b[0] - a[0])
      .map(([month, items]) => ({
        month,
        total: items.reduce((sum, t) => sum + t.amount, 0),
        items: [...items].sort((a, b) => b.txDate.localeCompare(a.txDate)),
      }));
    const added = grouped.reduce((sum, g) => sum + g.total, 0);
    const spentItems = [...(spentByYear.get(year) ?? [])].sort((a, b) =>
      b.txDate.localeCompare(a.txDate),
    );
    // This year's balance is today's, straight from Money App — proven, not
    // derived. Any earlier year is proven only if a credit report recorded it.
    const recorded = actuals.get(year);
    const proven =
      year === currentYear
        ? // Today's balance comes straight from the lenders via Money App —
          // the strongest evidence there is, and no older than this morning.
          {
            total,
            asOf: new Date().toISOString().slice(0, 10),
            from: "statement" as Evidence,
          }
        : recorded;

    rows.push({
      year,
      added,
      // Walking back can run past zero once the history reaches further back
      // than today's balance can explain — old loans since repaid, or accounts
      // that have closed. "Owed -$12,000" is nonsense, so it floors at zero.
      owed: Math.max(0, proven ? proven.total : owed),
      owedSource: proven
        ? { kind: "actual", asOf: proven.asOf, from: proven.from }
        : { kind: "estimated" },
      known: Boolean(months),
      months: grouped,
      spent: spentItems.reduce((sum, s) => sum + s.amount, 0),
      spentItems,
    });
    // Step to the year before. Starting from a proven figure where there is
    // one is the whole point: without it, one bad year's transactions would
    // skew every year below it.
    owed = (proven ? proven.total : owed) - added;
  }
  return rows;
}

export default function DebtByYear({
  transactions,
  spending,
  snapshots,
  payMonths,
  payProblem,
  total,
  currentYear,
  admin,
  onAdd,
  onDelete,
}: {
  transactions: DebtTransaction[];
  spending: DebtTransaction[];
  snapshots: DebtSnapshotRow[];
  // Business pay, keyed by month, shown inside the month it belongs to rather
  // than in a card of its own repeating the same months.
  payMonths: PayMonth[];
  payProblem: string | null;
  total: number;
  currentYear: number;
  admin: boolean;
  onAdd: (input: {
    tx_date: string;
    description: string;
    amount: number;
    source?: string;
  }) => void;
  onDelete: (id: string) => void;
}) {
  // The whole card folds away. It's the longest thing on the Debt page by a
  // long way, and it's the history — the balances above it are the answer to
  // "what do I owe", which is what the page has to say without being opened.
  const [open, setOpen] = useState(false);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null); // "2026-3"
  const [openSpend, setOpenSpend] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () => buildRows(transactions, spending, snapshots, total, currentYear),
    [transactions, spending, snapshots, total, currentYear],
  );
  const maxOwed = Math.max(...rows.map((r) => r.owed), 1);

  // "2026-3" -> that month's business pay.
  const payByMonth = new Map(
    payMonths.map((p) => [`${Number(p.month.slice(0, 4))}-${Number(p.month.slice(5, 7))}`, p]),
  );
  // Every month's gap added up. One month over is a rounding error; two years
  // of it is the story, so it leads.
  const totalGap = payMonths.reduce((sum, p) => sum + p.difference, 0);
  const thisYear = rows[0];
  const addedThisYear = thisYear?.known ? thisYear.added : 0;

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <CalendarDays size={15} />
          Debt by year
        </span>
        <span className="flex items-center gap-2">
          {/* The headline while it's shut, so closing the card doesn't hide
              the one number it exists to make. */}
          {!open && addedThisYear > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[12px] font-medium"
              style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
            >
              +{money(addedThisYear)} in {currentYear}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {!open && (
        <p className="mt-2 text-xs text-muted">
          Open it to see every year, the months inside them, and each
          transaction behind the totals.
        </p>
      )}

      {open && (
        <>
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

      {/* What the business side adds up to across every month. It used to head
          its own card, which repeated these same months underneath — so it
          moved here and the duplicate card went. */}
      {payMonths.length > 0 && (
        <div
          className="mt-3 rounded-xl p-3"
          style={{
            background: totalGap > 0 ? "var(--warn-bg)" : "var(--good-bg)",
            color: totalGap > 0 ? "var(--warn)" : "var(--good)",
          }}
        >
          <p className="text-[13px]">
            {totalGap > 0
              ? "Taken from the business above what you earned"
              : "Taken from the business below what you earned"}
          </p>
          <p className="text-2xl font-medium">{money(Math.abs(totalGap))}</p>
          <p className="mt-1 text-[13px]">
            {totalGap > 0
              ? "Chris put in the difference to cover it."
              : "You took less out than the work was worth."}
          </p>
        </div>
      )}

      {/* Admin-only: why the business half is missing, when it is. */}
      {payMonths.length === 0 && payProblem && admin && (
        <p className="mt-3 text-[13px] text-warn">{payProblem}</p>
      )}

      <p className="mt-1 text-xs text-muted">
        Tap a year to see the months, then a month to see every transaction —
        what Chris lent you and what the business paid, with the account each
        came out of so you can check it against a statement.
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((r, i) => {
          const yearOpen = openYear === r.year;
          // A year with nothing logged has nothing to open.
          const canOpen = r.known && r.months.length > 0;
          // This year's colour, used by its bar in the chart below too.
          const color = yearColor(i, rows.length);
          return (
            <div
              key={r.year}
              className="rounded-xl p-3"
              style={{ background: yearTint(i, rows.length) }}
            >
              <button
                className="w-full text-left disabled:cursor-default"
                onClick={() => setOpenYear(yearOpen ? null : r.year)}
                disabled={!canOpen}
                aria-expanded={canOpen ? yearOpen : undefined}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[15px] font-medium">
                    {canOpen && (
                      <ChevronDown
                        size={16}
                        className={`text-muted transition-transform ${yearOpen ? "rotate-180" : "-rotate-90"}`}
                      />
                    )}
                    {r.year}
                    {r.year === currentYear ? " so far" : ""}
                  </span>
                  {r.known ? (
                    // A year where more went back than went out is good news,
                    // and "+$-3,138 added" buried it. It gets said plainly, in
                    // the colour the rest of the app uses for good news.
                    r.added < 0 ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[13px] font-medium"
                        style={{ background: "var(--good-bg)", color: "var(--good)" }}
                      >
                        {money(Math.abs(r.added))} paid off
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 text-[13px] font-medium"
                        style={{ background: color, color: yearInk(i, rows.length) }}
                      >
                        +{money(r.added)} added
                      </span>
                    )
                  ) : (
                    <span className="text-[13px] text-muted">Coming soon</span>
                  )}
                </div>

                {r.known && (
                  <>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-card">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(r.owed / maxOwed) * 100}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                      <span>
                        Owed {money(r.owed)} · about{" "}
                        {money(monthlyAt15(r.owed))}/month to keep up
                      </span>
                      {/* Whether that balance is a recorded fact or worked out
                          backwards. Only the "owed" figure is in question —
                          "added" is always the year's real transactions. */}
                      {r.owedSource.kind === "actual" ? (
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ background: "var(--good-bg)", color: "var(--good)" }}
                          title={`A real balance, from a ${r.owedSource.from} dated ${r.owedSource.asOf}`}
                        >
                          Actual · {r.owedSource.from}
                        </span>
                      ) : (
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ background: "var(--tint)", color: "var(--faint)" }}
                          title="Worked out backwards from a later known balance — no credit report recorded this year"
                        >
                          Estimated
                        </span>
                      )}
                    </p>
                  </>
                )}
              </button>

              {/* Spent on Jamie that year but never called a loan — gifts and
                  the like. Its own line, outside the year button, because it
                  isn't part of the debt above it and opens separately. */}
              {r.spent > 0 && (
                <>
                  <button
                    className="mt-2 flex w-full items-center gap-1 rounded-lg bg-card px-2 py-1.5 text-left text-xs"
                    onClick={() => setOpenSpend(openSpend === r.year ? null : r.year)}
                    aria-expanded={openSpend === r.year}
                  >
                    <Gift size={12} className="shrink-0" style={{ color: "var(--accent)" }} />
                    <span className="flex-1">
                      Chris spent{" "}
                      <span className="font-medium">{money(r.spent)}</span> not
                      assigned as a loan
                    </span>
                    <ChevronDown
                      size={12}
                      className={`shrink-0 text-muted transition-transform ${openSpend === r.year ? "rotate-180" : "-rotate-90"}`}
                    />
                  </button>

                  {openSpend === r.year && (
                    <ul className="mt-1 space-y-2 pl-5">
                      {r.spentItems.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px]">{s.description}</p>
                            <p className="text-xs text-muted">{s.txDate}</p>
                            {s.source && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                <Landmark size={11} className="shrink-0" />
                                <span className="truncate">{s.source}</span>
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-[14px]">
                            {money(s.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {yearOpen && (
                <div className="mt-2 pl-4">
                  {r.months.map((m) => {
                    const key = `${r.year}-${m.month}`;
                    const monthOpen = openMonth === key;
                    return (
                      <div key={key}>
                        <button
                          className="flex w-full items-center justify-between py-2"
                          onClick={() => setOpenMonth(monthOpen ? null : key)}
                          aria-expanded={monthOpen}
                        >
                          <span className="flex items-center gap-1.5 text-[14px]">
                            <ChevronDown
                              size={14}
                              className={`text-muted transition-transform ${monthOpen ? "rotate-180" : "-rotate-90"}`}
                            />
                            {MONTH_NAMES[m.month - 1]}
                          </span>
                          <span className="text-[14px] text-muted">
                            {money(m.total)}
                          </span>
                        </button>

                        {monthOpen && (
                          <div className="pb-2 pl-5">
                          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">
                            Chris lent you
                          </p>
                          <ul className="space-y-2">
                            {m.items.map((t) => (
                              <li
                                key={t.id}
                                className="flex items-start justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[14px]">
                                    {t.description}
                                  </p>
                                  <p className="text-xs text-muted">{t.txDate}</p>
                                  {/* The account is the audit trail: it's what
                                      this line gets checked against on a
                                      statement, so it gets its own row rather
                                      than trailing off the date. */}
                                  {t.source && (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                      <Landmark size={11} className="shrink-0" />
                                      <span className="truncate">{t.source}</span>
                                    </p>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {/* A repayment comes through negative. Left
                                      as a bare minus it reads like a smaller
                                      loan, so it's named. */}
                                  <span className="text-right text-[14px]">
                                    {t.amount < 0 ? (
                                      <>
                                        {money(Math.abs(t.amount))}
                                        <span className="block text-xs text-muted">
                                          paid back
                                        </span>
                                      </>
                                    ) : (
                                      money(t.amount)
                                    )}
                                  </span>
                                  {admin && (
                                    <button
                                      onClick={() => onDelete(t.id)}
                                      aria-label={`Delete ${t.description}`}
                                    >
                                      <Trash2 size={14} className="text-muted" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                          {payByMonth.get(key) && (
                            <BusinessPayMonth pay={payByMonth.get(key)!} />
                          )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {admin &&
        (adding ? (
          <AddTransactionForm
            onCancel={() => setAdding(false)}
            onSave={(input) => {
              setAdding(false);
              onAdd(input);
            }}
          />
        ) : (
          <button
            className="mt-3 flex items-center gap-1.5 text-[13px] text-muted"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} />
            Add a transaction
          </button>
        ))}

      {/* The same years as a shape. The rows carry the exact figures, so this
          is here to show the trend at a glance, not to be read off. */}
      <DebtGrowthChart
        points={rows
          .filter((r) => r.known)
          .map((r) => ({ year: r.year, owed: r.owed }))}
      />

      <p className="mt-3 text-xs text-muted">
        &quot;To keep up&quot; means one month of interest at 15% plus 1% of what
        you owe — how a credit card works out a minimum payment. Every extra
        $1,000 you borrow adds about $23 a month, forever, until it&apos;s paid
        off.
      </p>
        </>
      )}
    </Card>
  );
}

function AddTransactionForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: {
    tx_date: string;
    description: string;
    amount: number;
    source?: string;
  }) => void;
}) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");

  const valid = date !== "" && description.trim() !== "" && Number(amount) > 0;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">New transaction</span>
        <button onClick={onCancel} aria-label="Cancel">
          <X size={16} className="text-muted" />
        </button>
      </div>
      <input
        type="date"
        className={inputClass}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Date"
      />
      <input
        className={inputClass}
        placeholder="What was it for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Description"
      />
      <input
        type="number"
        inputMode="decimal"
        className={inputClass}
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Amount"
      />
      <input
        className={inputClass}
        placeholder="Card or loan (optional)"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        aria-label="Card or loan"
      />
      <button
        className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: "var(--good)" }}
        disabled={!valid}
        onClick={() =>
          onSave({
            tx_date: date,
            description: description.trim(),
            amount: Number(amount),
            source: source.trim() || undefined,
          })
        }
      >
        Save
      </button>
    </div>
  );
}
