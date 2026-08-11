"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Landmark, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import type { DebtTransaction } from "@/lib/store";

// One card, one list of years. This used to be two — a "Debt by year" summary
// and a separate "Where the debt came from" drill-down — which meant scrolling
// past the same years twice to get from a total to the transactions behind it.
// The years are now the drill-down: tap one and it opens.

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

type YearRow = {
  year: number;
  added: number;
  owed: number; // what was owed at the end of that year
  known: boolean; // false -> "Coming soon"
  months: MonthGroup[];
  // Spent on Jamie that year but never treated as a loan. Deliberately kept
  // out of `added` and `owed` — it isn't debt and nothing here may add it to a
  // debt figure.
  spent: number;
  spentItems: DebtTransaction[];
};

// Build one row per year, newest first, each carrying the months inside it.
// We know today's total, so we walk backwards: last year's total is this
// year's total minus what got added.
function buildRows(
  txs: DebtTransaction[],
  spending: DebtTransaction[],
  total: number,
  currentYear: number,
): YearRow[] {
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

  const rows: YearRow[] = [];
  let owed = total;
  for (let year = currentYear; year >= FIRST_YEAR; year--) {
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
    rows.push({
      year,
      added,
      owed,
      known: Boolean(months),
      months: grouped,
      spent: spentItems.reduce((sum, s) => sum + s.amount, 0),
      spentItems,
    });
    owed -= added;
  }
  return rows;
}

export default function DebtByYear({
  transactions,
  spending,
  total,
  currentYear,
  admin,
  onAdd,
  onDelete,
}: {
  transactions: DebtTransaction[];
  spending: DebtTransaction[];
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
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null); // "2026-3"
  const [openSpend, setOpenSpend] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () => buildRows(transactions, spending, total, currentYear),
    [transactions, spending, total, currentYear],
  );
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

      <p className="mt-1 text-xs text-muted">
        Tap a year to see the months, then a month to see every transaction — and
        which account it came out of, so you can check it against a statement.
      </p>

      <div className="mt-3 divide-y divide-border border-t border-border">
        {rows.map((r) => {
          const yearOpen = openYear === r.year;
          // A year with nothing logged has nothing to open.
          const canOpen = r.known && r.months.length > 0;
          return (
            <div key={r.year} className="py-3">
              <button
                className="w-full text-left disabled:cursor-default"
                onClick={() => setOpenYear(yearOpen ? null : r.year)}
                disabled={!canOpen}
                aria-expanded={canOpen ? yearOpen : undefined}
              >
                <div className="flex items-baseline justify-between">
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
              </button>

              {/* Spent on Jamie that year but never called a loan — gifts and
                  the like. Its own line, outside the year button, because it
                  isn't part of the debt above it and opens separately. */}
              {r.spent > 0 && (
                <>
                  <button
                    className="mt-1.5 flex w-full items-center gap-1 text-left text-xs text-muted underline decoration-dotted underline-offset-2"
                    onClick={() => setOpenSpend(openSpend === r.year ? null : r.year)}
                    aria-expanded={openSpend === r.year}
                  >
                    <ChevronDown
                      size={12}
                      className={`shrink-0 transition-transform ${openSpend === r.year ? "rotate-180" : "-rotate-90"}`}
                    />
                    Chris spent {money(r.spent)} not assigned as a loan
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
                          <ul className="space-y-2 pb-2 pl-5">
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

      <p className="mt-3 text-xs text-muted">
        &quot;To keep up&quot; means one month of interest at 15% plus 1% of what
        you owe — how a credit card works out a minimum payment. Every extra
        $1,000 you borrow adds about $23 a month, forever, until it&apos;s paid
        off.
      </p>
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
