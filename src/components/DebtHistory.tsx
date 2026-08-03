"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, History, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import type { DebtTransaction } from "@/lib/store";
import { addDebtTransaction, deleteDebtTransaction } from "@/lib/actions";

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
type YearGroup = { year: number; total: number; months: MonthGroup[] };

// Bucket the flat transaction list into years, then months inside each year.
// Both come back newest first, and so do the transactions inside a month.
function groupByYearAndMonth(txs: DebtTransaction[]): YearGroup[] {
  const years = new Map<number, Map<number, DebtTransaction[]>>();
  for (const tx of txs) {
    // tx_date is stored as YYYY-MM-DD, so read the parts off the string
    // instead of `new Date()` — that would shift the day by the timezone.
    const [y, m] = tx.txDate.split("-").map(Number);
    if (!y || !m) continue;
    const months = years.get(y) ?? new Map<number, DebtTransaction[]>();
    months.set(m, [...(months.get(m) ?? []), tx]);
    years.set(y, months);
  }

  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => {
      const grouped: MonthGroup[] = [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, items]) => ({
          month,
          total: items.reduce((sum, t) => sum + t.amount, 0),
          items: [...items].sort((a, b) => b.txDate.localeCompare(a.txDate)),
        }));
      return {
        year,
        total: grouped.reduce((sum, g) => sum + g.total, 0),
        months: grouped,
      };
    });
}

export default function DebtHistory({
  initialTransactions,
  admin,
}: {
  initialTransactions: DebtTransaction[];
  admin: boolean;
}) {
  const [txs, setTxs] = useState<DebtTransaction[]>(initialTransactions);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null); // "2026-3"
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1);

  const years = useMemo(() => groupByYearAndMonth(txs), [txs]);

  function handleAdd(input: {
    tx_date: string;
    description: string;
    amount: number;
    source?: string;
  }) {
    const tid = String(tempId.current--);
    setTxs((list) => [
      ...list,
      {
        id: tid,
        txDate: input.tx_date,
        description: input.description,
        amount: input.amount,
        source: input.source,
      },
    ]);
    setAdding(false);
    startTransition(async () => {
      // Swap the temp id for the real DB id so a later delete works.
      const res = await addDebtTransaction(input);
      if (res.ok && res.id) {
        setTxs((list) => list.map((t) => (t.id === tid ? { ...t, id: res.id! } : t)));
      } else if (!res.ok) {
        setTxs((list) => list.filter((t) => t.id !== tid));
      }
    });
  }

  function handleDelete(id: string) {
    setTxs((list) => list.filter((t) => t.id !== id));
    startTransition(() => {
      deleteDebtTransaction(id);
    });
  }

  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <History size={15} />
        Where the debt came from
      </p>

      {years.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">
          Nothing added yet. Add the charges that built the debt and they&apos;ll
          show up here by year and month.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border border-t border-border">
          {years.map((y) => {
            const yearOpen = openYear === y.year;
            return (
              <div key={y.year}>
                <button
                  className="flex w-full items-center justify-between py-3"
                  onClick={() => setOpenYear(yearOpen ? null : y.year)}
                  aria-expanded={yearOpen}
                >
                  <span className="flex items-center gap-1.5 text-[15px] font-medium">
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform ${yearOpen ? "rotate-180" : "-rotate-90"}`}
                    />
                    {y.year}
                  </span>
                  <span className="text-[15px]">{money(y.total)}</span>
                </button>

                {yearOpen && (
                  <div className="pb-2 pl-4">
                    {y.months.map((m) => {
                      const key = `${y.year}-${m.month}`;
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
                                    <p className="text-xs text-muted">
                                      {t.txDate}
                                      {t.source ? ` · ${t.source}` : ""}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-[14px]">
                                      {money(t.amount)}
                                    </span>
                                    {admin && (
                                      <button
                                        onClick={() => handleDelete(t.id)}
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
      )}

      {admin &&
        (adding ? (
          <AddTransactionForm
            onCancel={() => setAdding(false)}
            onSave={handleAdd}
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
