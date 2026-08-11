"use client";

import { useRef, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Check,
  Pencil,
  Upload,
  TrendingDown,
  ChevronDown,
  Gauge,
  X,
} from "lucide-react";
import { Card, Bar } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import {
  carLoanBalance,
  cardBalance,
  duration,
  financeCharge,
  monthlyInterest,
  personalLoanBalance,
  simulate,
  totalBalance,
  totalMinimum,
} from "@/lib/payoff";
import { parseReportText, type ParsedDebt } from "@/lib/parseReport";
import { extractPdfText } from "@/lib/pdfText";
import PlaidConnect from "@/components/PlaidConnect";
import MoneyAppConnect from "@/components/MoneyAppConnect";
import DuplicateCleanup from "@/components/DuplicateCleanup";
import DebtByYear from "@/components/DebtByYear";
import type { DebtTransaction } from "@/lib/store";
import {
  addDebt,
  addDebtTransaction,
  deleteDebt,
  deleteDebtTransaction,
  importDebts,
  updateDebt,
} from "@/lib/actions";

function ficoLabel(score: number): string {
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Needs work";
}

// "You owe $36,759 on credit card debt, $86,767 on Car loan, $4,000 on
// personal loan and a total of $127,526." A kind with nothing owed on it drops
// out rather than reading "$0 on Car loan", and if none apply it's the total
// on its own.
function owedSentence(
  cards: number,
  carLoans: number,
  personalLoans: number,
  total: number,
): string {
  const parts: string[] = [];
  if (cards > 0) parts.push(`${money(cards)} on credit card debt`);
  if (carLoans > 0) parts.push(`${money(carLoans)} on Car loan`);
  if (personalLoans > 0) parts.push(`${money(personalLoans)} on personal loan`);
  if (parts.length === 0) return `You owe ${money(total)}.`;
  return `You owe ${parts.join(", ")} and a total of ${money(total)}.`;
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

export default function DebtClient({
  initialDebts,
  admin,
  hasBank,
  fico,
  initialTransactions,
  currentYear,
}: {
  initialDebts: Debt[];
  admin: boolean;
  hasBank: boolean;
  fico: { score: number; date: string } | null;
  initialTransactions: DebtTransaction[];
  currentYear: number;
}) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  // The transactions live up here so the headline and the year card always
  // show the same numbers when something is added or deleted.
  const [txs, setTxs] = useState<DebtTransaction[]>(initialTransactions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extra, setExtra] = useState(100);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1);

  const total = totalBalance(debts);
  const minTotal = totalMinimum(debts);
  const mo = monthlyInterest(debts);
  const cards = cardBalance(debts);
  const carLoans = carLoanBalance(debts);
  const personalLoans = personalLoanBalance(debts);

  // New debt added, bucketed by the year of each charge. Newest year first.
  const byYear = new Map<number, number>();
  for (const tx of txs) {
    // tx_date is YYYY-MM-DD; read the year off the string so a timezone
    // shift can't push a January 1st charge into the year before.
    const year = Number(tx.txDate.slice(0, 4));
    if (!year) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + tx.amount);
  }

  function handleAdd(data: Omit<Debt, "id" | "monthly" | "paidPct">) {
    const tid = String(tempId.current--);
    setDebts((d) => [...d, { ...data, id: tid, monthly: data.minPayment, paidPct: 0 }]);
    setAdding(false);
    startTransition(async () => {
      // Swap the temp id for the real DB id so a later edit/delete works.
      const res = await addDebt(data);
      if (res.ok && res.id) {
        setDebts((d) => d.map((x) => (x.id === tid ? { ...x, id: res.id! } : x)));
      } else if (!res.ok) {
        setDebts((d) => d.filter((x) => x.id !== tid));
      }
    });
  }

  function handleUpdate(debt: Debt) {
    setDebts((d) => d.map((x) => (x.id === debt.id ? debt : x)));
    setEditingId(null);
    startTransition(() => {
      updateDebt({
        id: debt.id,
        name: debt.name,
        balance: debt.balance,
        apr: debt.apr,
        minPayment: debt.minPayment,
      });
    });
  }

  function handleDelete(id: string) {
    setDebts((d) => d.filter((x) => x.id !== id));
    startTransition(() => {
      deleteDebt(id);
    });
  }

  function handleImport(rows: ParsedDebt[]) {
    const tids = rows.map(() => String(tempId.current--));
    const added: Debt[] = rows.map((r, i) => ({
      id: tids[i],
      name: r.name,
      balance: r.balance,
      apr: r.apr,
      minPayment: r.minPayment,
      monthly: r.minPayment,
      paidPct: 0,
    }));
    setDebts((d) => [...d, ...added]);
    setImporting(false);
    startTransition(async () => {
      // Line up the real DB ids (returned in input order) with our temp rows.
      const res = await importDebts(rows);
      if (res.ok && res.ids) {
        setDebts((d) =>
          d.map((x) => {
            const idx = tids.indexOf(x.id);
            return idx >= 0 && res.ids![idx] ? { ...x, id: res.ids![idx] } : x;
          })
        );
      } else if (!res.ok) {
        setDebts((d) => d.filter((x) => !tids.includes(x.id)));
      }
    });
  }

  function handleAddTransaction(input: {
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

  function handleDeleteTransaction(id: string) {
    setTxs((list) => list.filter((t) => t.id !== id));
    startTransition(() => {
      deleteDebtTransaction(id);
    });
  }

  return (
    <div className="space-y-4">
      {/* This year's headline. The years before it used to be listed here too,
          but they're the same rows the card below opens with — so they live in
          one place now instead of being scrolled past twice. */}
      <div className="rounded-2xl bg-warn-bg p-4">
        <p className="text-[13px] uppercase tracking-wide text-warn">
          New debt added this year
        </p>
        <p className="text-3xl font-medium text-warn">
          {money(byYear.get(currentYear) ?? 0)}
        </p>
        <p className="mt-3 text-[13px] text-warn">
          {owedSentence(cards, carLoans, personalLoans, total)}
        </p>
      </div>

      {/* Year by year: what got added, what it costs each month, and — once a
          year is opened — the months and transactions behind it. */}
      <DebtByYear
        transactions={txs}
        total={total}
        currentYear={currentYear}
        admin={admin}
        onAdd={handleAddTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* Credit score, last pulled from Money App */}
      {fico && (
        <Card>
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <Gauge size={15} />
            Credit score
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-medium">{fico.score}</span>
            <span className="text-[13px] text-muted">{ficoLabel(fico.score)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            From Money App, updated {fico.date}.
          </p>
        </Card>
      )}

      {/* Pull debts straight from the bank or Money App (primary), with paste-a-report as backup */}
      {admin &&
        (importing ? (
          <ImportPanel
            onCancel={() => setImporting(false)}
            onImport={handleImport}
          />
        ) : (
          <div className="space-y-2">
            <PlaidConnect hasBank={hasBank} />
            <MoneyAppConnect />
            <DuplicateCleanup />
            <button
              className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-muted"
              onClick={() => setImporting(true)}
            >
              <Upload size={13} />
              or paste a credit report instead
            </button>
          </div>
        ))}

      {/* Payoff what-if calculator */}
      {debts.length > 0 && (
        <PayoffCalculator
          debts={debts}
          minTotal={minTotal}
          extra={extra}
          setExtra={setExtra}
        />
      )}

      {/* Debt list */}
      <Card>
        <p className="mb-2 text-[13px] text-muted">Your debts</p>
        <div className="space-y-3">
          {debts.map((d) =>
            editingId === d.id ? (
              <DebtForm
                key={d.id}
                initial={d}
                onCancel={() => setEditingId(null)}
                onSave={(data) => handleUpdate({ ...d, ...data })}
              />
            ) : (
              <div key={d.id}>
                <div className="flex items-center justify-between font-medium">
                  <span className="truncate">{d.name}</span>
                  <span className="flex items-center gap-3">
                    {money(d.balance)}
                    {admin && (
                      <>
                        <button
                          aria-label="Edit"
                          className="text-muted"
                          onClick={() => setEditingId(d.id)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label="Delete"
                          className="text-muted"
                          onClick={() => handleDelete(d.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
                <p className="mb-2 mt-1 text-xs text-muted">
                  {d.apr}% interest · {money(d.minPayment)}/mo minimum
                  {financeCharge(d) > 0 && (
                    <> · {money(financeCharge(d))}/mo finance charge</>
                  )}
                </p>
                {d.paidPct > 0 && <Bar pct={d.paidPct} />}
              </div>
            )
          )}
        </div>

        {/* What the whole list costs each month: what has to be paid, and how
            much of that is pure interest. */}
        {debts.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Minimum payments</span>
              <span>{money(minTotal)}/mo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Finance charges</span>
              <span className="text-warn">{money(mo)}/mo</span>
            </div>
            {minTotal > 0 && mo > 0 && (
              <p className="pt-1 text-muted">
                {mo >= minTotal
                  ? "Paying the minimums doesn't cover the interest — the balance grows."
                  : `${money(minTotal - mo)}/mo of the minimums actually comes off what you owe.`}
              </p>
            )}
          </div>
        )}

        {admin &&
          (adding ? (
            <div className="mt-3">
              <DebtForm onCancel={() => setAdding(false)} onSave={handleAdd} />
            </div>
          ) : (
            <button
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
              onClick={() => setAdding(true)}
            >
              <Plus size={16} />
              Add a debt
            </button>
          ))}
      </Card>

    </div>
  );
}

// ── Payoff calculator ─────────────────────────────────────────────────────────
function PayoffCalculator({
  debts,
  minTotal,
  extra,
  setExtra,
}: {
  debts: Debt[];
  minTotal: number;
  extra: number;
  setExtra: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const base = simulate(debts, minTotal);
  const fast = simulate(debts, minTotal + extra);
  const monthsSaved = Math.max(0, base.months - fast.months);
  const interestSaved = Math.max(0, base.totalInterest - fast.totalInterest);

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <TrendingDown size={15} />
          What if you pay extra?
        </span>
        <ChevronDown
          size={16}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-[15px]">Extra per month</span>
            <span className="text-lg font-medium">{money(extra)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={25}
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--good)]"
          />
          <p className="mt-1 text-xs text-muted">
            Paying {money(minTotal + extra)}/month in total.
          </p>

          <div className="mt-4 rounded-xl bg-good-bg p-3 text-center">
            <p className="text-[13px] text-good">Debt-free in</p>
            <p className="text-2xl font-medium text-good">
              {duration(fast.months)}
            </p>
            <p className="text-xs text-good">
              vs {duration(base.months)} paying just the minimums
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-tint p-3">
              <p className="text-xs text-muted">Sooner by</p>
              <p className="text-lg font-medium">{duration(monthsSaved)}</p>
            </div>
            <div className="rounded-xl bg-tint p-3">
              <p className="text-xs text-muted">Interest saved</p>
              <p className="text-lg font-medium">{money(interestSaved)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            An estimate. Extra money goes at your highest-interest debt first —
            the fastest way out.
          </p>
        </>
      )}
    </Card>
  );
}

// ── Import panel (upload PDF or paste text) ───────────────────────────────────
function ImportPanel({
  onCancel,
  onImport,
}: {
  onCancel: () => void;
  onImport: (rows: ParsedDebt[]) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedDebt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const extracted = await extractPdfText(file);
      if (!extracted.trim()) {
        setNote(
          "Couldn't read text from that PDF. Try copy-pasting the report text below."
        );
      } else {
        setText(extracted);
        setRows(parseReportText(extracted));
      }
    } catch {
      setNote(
        "Couldn't open that file. Try copy-pasting the report text below instead."
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function parsePasted() {
    setRows(parseReportText(text));
  }

  function updateRow(i: number, patch: Partial<ParsedDebt>) {
    setRows((r) =>
      r ? r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) : r
    );
  }

  function removeRow(i: number) {
    setRows((r) => (r ? r.filter((_, idx) => idx !== i) : r));
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-medium">Import debts</p>
        <button aria-label="Close" className="text-muted" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>

      {rows === null ? (
        <>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted">
            <Upload size={16} />
            {busy ? "Reading…" : "Upload a credit-report PDF"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onFile}
              disabled={busy}
            />
          </label>

          <p className="my-2 text-center text-xs text-muted">or paste the text</p>
          <textarea
            className={inputClass + " h-28 resize-none"}
            placeholder="Paste the text from your credit report here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {note && <p className="mt-2 text-xs text-warn">{note}</p>}
          <div className="mt-3 flex justify-end">
            <button
              className={primaryBtn}
              style={{ background: "var(--good)" }}
              onClick={parsePasted}
              disabled={!text.trim()}
            >
              Read debts
            </button>
          </div>
        </>
      ) : rows.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-muted">
            Couldn&apos;t find any debts in that text.
          </p>
          <button
            className="mt-3 rounded-lg border border-border px-3 py-2 text-sm"
            onClick={() => setRows(null)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            Found {rows.length}. Check the numbers, fix anything wrong, then add.
          </p>
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="rounded-xl bg-tint p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                  />
                  <button
                    aria-label="Remove"
                    className="text-muted"
                    onClick={() => removeRow(i)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field
                    label="Balance $"
                    value={row.balance}
                    onChange={(v) => updateRow(i, { balance: v })}
                  />
                  <Field
                    label="Rate %"
                    value={row.apr}
                    onChange={(v) => updateRow(i, { apr: v })}
                  />
                  <Field
                    label="Min $/mo"
                    value={row.minPayment}
                    onChange={(v) => updateRow(i, { minPayment: v })}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="rounded-lg px-3 py-2 text-sm text-muted"
              onClick={() => setRows(null)}
            >
              Back
            </button>
            <button
              className={primaryBtn + " flex items-center gap-1.5"}
              style={{ background: "var(--good)" }}
              onClick={() => onImport(rows)}
            >
              <Check size={16} />
              Add {rows.length} debt{rows.length === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

// ── Add / edit one debt ───────────────────────────────────────────────────────
function DebtForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Debt;
  onCancel: () => void;
  onSave: (data: {
    name: string;
    balance: number;
    apr: number;
    minPayment: number;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [balance, setBalance] = useState(String(initial?.balance ?? ""));
  const [apr, setApr] = useState(String(initial?.apr ?? ""));
  const [minPayment, setMinPayment] = useState(
    String(initial?.minPayment ?? "")
  );

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      balance: Math.max(0, Math.round(Number(balance) || 0)),
      apr: Math.max(0, Number(apr) || 0),
      minPayment: Math.max(0, Math.round(Number(minPayment) || 0)),
    });
  }

  return (
    <div className="space-y-2 rounded-xl bg-tint p-3">
      <input
        className={inputClass}
        placeholder="Debt name (e.g. Visa card)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        <Field
          label="Balance $"
          value={Number(balance) || 0}
          onChange={(v) => setBalance(String(v))}
        />
        <Field
          label="Rate %"
          value={Number(apr) || 0}
          onChange={(v) => setApr(String(v))}
        />
        <Field
          label="Min $/mo"
          value={Number(minPayment) || 0}
          onChange={(v) => setMinPayment(String(v))}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button className="rounded-lg px-3 py-2 text-sm text-muted" onClick={onCancel}>
          Cancel
        </button>
        <button
          className={primaryBtn + " flex items-center gap-1.5"}
          style={{ background: "var(--good)" }}
          onClick={submit}
        >
          <Check size={16} />
          Save
        </button>
      </div>
    </div>
  );
}
