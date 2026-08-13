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
  AlertCircle,
} from "lucide-react";
import { Card, Bar } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import {
  carLoanBalance,
  cardBalance,
  duration,
  financeCharge,
  isCarLoan,
  isUnsecured,
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
import type { DebtSnapshotRow, DebtTransaction, SettlementTerms } from "@/lib/store";
import type { PayMonth } from "@/lib/gymPay";
import {
  addDebt,
  addDebtTransaction,
  deleteDebt,
  deleteDebtTransaction,
  importDebts,
  setSettlementTerms,
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

// Which rows belong to the gym rather than to Jamie personally. Money App says
// so outright, which is the only thing that gets it right: the names give no
// usable rule — "Business Platinum Card" and "US Bank Card (JM)" are the gym's
// while "US Bank Auto Loan" is Jamie's, and matching on "US Bank" or "business"
// mis-sorts one or the other.
//
// Anything without a scope is personal. Rows typed in by hand have none, and a
// debt of Jamie's shown under Business is a worse error than the reverse.
function isBusinessDebt(debt: Debt): boolean {
  return debt.scope === "business";
}

// What Jamie owes Chris out of the settlement, as one line in the list.
//
// Chris sets the total, the rate and the term. The monthly payment is worked
// out from those three rather than typed, so it can't sit on screen disagreeing
// with them — $200,000 paid at $900 a month is a different arrangement from the
// one those numbers describe, and nothing on the page would have said so.
//
// Until he sets anything there's only the monthly support figure from the
// Divorce page, so it's multiplied out over the default term and labelled an
// estimate. That fallback works out to exactly the support figure, which is
// what the row showed before any of this was editable.
const SETTLEMENT_MONTHS = 60; // five years
const SETTLEMENT_APR = 0; // a settlement doesn't charge interest unless Chris says so

// Nothing set — the shape the row falls back to.
const NO_TERMS: SettlementTerms = { total: null, apr: null, months: null };

// The level payment that clears `total` over `months` at `apr`. The standard
// amortisation formula; at 0% it's just the total split evenly, which the
// formula itself can't do (it divides by zero).
function monthlyPayment(total: number, apr: number, months: number): number {
  if (months <= 0) return total;
  const r = apr / 100 / 12;
  if (r === 0) return total / months;
  return (total * r) / (1 - Math.pow(1 + r, -months));
}

function settlementLoan(supportMonthly: number, terms: SettlementTerms): Debt {
  const months = terms.months ?? SETTLEMENT_MONTHS;
  const apr = terms.apr ?? SETTLEMENT_APR;
  const balance = terms.total ?? supportMonthly * months;
  return {
    id: "__divorce_settlement__",
    name: "Divorce Settlement Loan",
    balance,
    monthly: monthlyPayment(balance, apr, months),
    paidPct: 0,
    apr,
    minPayment: monthlyPayment(balance, apr, months),
    debtType: "settlement",
  };
}

export default function DebtClient({
  initialDebts,
  admin,
  hasBank,
  fico,
  initialTransactions,
  spending,
  snapshots,
  payMonths,
  payProblem,
  currentYear,
  settlementMonthly,
  settlementTerms,
}: {
  initialDebts: Debt[];
  admin: boolean;
  hasBank: boolean;
  fico: { score: number; date: string } | null;
  initialTransactions: DebtTransaction[];
  spending: DebtTransaction[];
  snapshots: DebtSnapshotRow[];
  payMonths: PayMonth[];
  payProblem: string | null;
  currentYear: number;
  settlementMonthly: number; // monthly support from the Divorce page
  settlementTerms: SettlementTerms; // what Chris set; nulls fall back to the estimate
}) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  // The transactions live up here so the headline and the year card always
  // show the same numbers when something is added or deleted.
  const [txs, setTxs] = useState<DebtTransaction[]>(initialTransactions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extra, setExtra] = useState(100);
  // What Chris set the settlement to, held here so the number moves the moment
  // he saves rather than after the round trip.
  const [terms, setTerms] = useState<SettlementTerms>(settlementTerms);
  const [editingSettlement, setEditingSettlement] = useState(false);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1);

  // The settlement is shown alongside the real debts but isn't one of them: it
  // has no row in the database, and it's an estimate rather than a balance
  // anyone agreed to. So it's built here and kept out of everything that
  // reasons about actual debt — the year-by-year story, the "you owe" sentence,
  // the payoff maths — and added only to the secured totals at the top.
  const settlement = settlementLoan(settlementMonthly, terms);
  const businessDebts = debts.filter(isBusinessDebt);
  const personalDebts = debts.filter((d) => !isBusinessDebt(d));

  // Jamie's own debt, and only his. The year-by-year story, the "you owe"
  // sentence and the payoff maths are all about what he borrowed and what he
  // can pay down, so the gym's accounts stay out of them — they aren't his to
  // pay, and their balance history isn't mirrored here either, so counting them
  // would move this year's figure while every earlier year sat still.
  const total = totalBalance(personalDebts);
  const minTotal = totalMinimum(personalDebts);
  const cards = cardBalance(personalDebts);
  const carLoans = carLoanBalance(personalDebts);
  const personalLoans = personalLoanBalance(personalDebts);

  // The sections at the top, which do count everything that's owed.
  const personalTotal = total + settlement.balance;
  const businessTotal = totalBalance(businessDebts);
  const securedTotal = personalTotal + businessTotal;
  const securedMin = totalMinimum(debts) + settlement.minPayment;
  const securedInterest = monthlyInterest(debts);

  // The same money cut a different way: what's behind each debt rather than
  // whose it is. The settlement is its own line rather than folded into
  // unsecured, so the three add up to the total exactly.
  const carDebts = debts.filter(isCarLoan);
  const unsecuredDebts = debts.filter(isUnsecured);
  const breakdown = [
    {
      key: "unsecured",
      label: "Unsecured",
      note: "cards and loans with nothing behind them",
      balance: totalBalance(unsecuredDebts),
      monthly: totalMinimum(unsecuredDebts),
    },
    {
      key: "car",
      label: "Car",
      note: "backed by the car itself",
      balance: totalBalance(carDebts),
      monthly: totalMinimum(carDebts),
    },
    {
      key: "divorce",
      label: "Divorce settlement",
      note: terms.total === null ? "estimated" : "what Jamie owes Chris",
      balance: settlement.balance,
      monthly: settlement.minPayment,
    },
  ].filter((row) => row.balance > 0);

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

  // All-null clears Chris's figures and puts the row back on its own estimate.
  function handleSaveSettlement(next: SettlementTerms) {
    const previous = terms;
    setTerms(next);
    setEditingSettlement(false);
    startTransition(async () => {
      const res = await setSettlementTerms(next);
      // Put the old numbers back rather than leave figures on screen that aren't
      // the ones saved — this is money Jamie is being told he owes.
      if (!res.ok) setTerms(previous);
    });
  }

  function handleDeleteTransaction(id: string) {
    setTxs((list) => list.filter((t) => t.id !== id));
    startTransition(() => {
      deleteDebtTransaction(id);
    });
  }

  // One row of the two lists below. Editing swaps it for the form in place, so
  // both sections behave the same way without repeating the markup twice.
  function row(d: Debt) {
    if (editingId === d.id) {
      return (
        <DebtForm
          key={d.id}
          initial={d}
          onCancel={() => setEditingId(null)}
          onSave={(data) => handleUpdate({ ...d, ...data })}
        />
      );
    }
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      {/* Everything owed, in one number, before the page breaks it apart. */}
      <Card>
        <p className="text-[13px] text-muted">Total Debt</p>
        <p className="mt-1 text-3xl font-medium">{money(securedTotal)}</p>
        <p className="mt-2 text-xs text-muted">
          {money(securedMin)}/mo minimum · {money(securedInterest)}/mo of that is
          interest
        </p>

        {/* The same total split by what's behind each debt. These three add up
            to the figure above — nothing is counted twice or left out. */}
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {breakdown.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="text-[15px]">{row.label}</span>
                <span className="block text-xs text-muted">{row.note}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="text-[15px] font-medium">{money(row.balance)}</span>
                <span className="block text-xs text-muted">
                  {money(row.monthly)}/mo
                </span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Jamie's own debts, plus what's owed to Chris out of the settlement. */}
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[13px] font-medium">Personal Debt Secured</p>
          <p className="text-[13px] text-muted">{money(personalTotal)}</p>
        </div>
        <div className="space-y-3">
          {personalDebts.map(row)}

          {/* The settlement. It has no row in the database — Chris either sets
              the figure or the page works one out from the monthly amount, and
              it says which of the two you're looking at. */}
          {editingSettlement ? (
            <SettlementForm
              current={terms}
              estimate={settlementLoan(settlementMonthly, NO_TERMS)}
              onCancel={() => setEditingSettlement(false)}
              onSave={handleSaveSettlement}
            />
          ) : (
            <div>
              <div className="flex items-center justify-between font-medium">
                <span className="truncate">{settlement.name}</span>
                <span className="flex items-center gap-3">
                  {money(settlement.balance)}
                  {admin && (
                    <button
                      aria-label="Edit the settlement total"
                      className="text-muted"
                      onClick={() => setEditingSettlement(true)}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                {terms.total === null && (
                  <span className="rounded bg-tint px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Estimated
                  </span>
                )}
                <span>
                  {settlement.apr > 0
                    ? `${settlement.apr}% interest`
                    : "no interest"}{" "}
                  · {money(settlement.minPayment)}/mo over{" "}
                  {duration(terms.months ?? SETTLEMENT_MONTHS)}
                </span>
              </p>
              {terms.total === null && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  A guess, not a number anyone agreed to:{" "}
                  {money(settlement.minPayment)} a month over five years. The
                  real figure comes out of the settlement.
                </p>
              )}
            </div>
          )}
        </div>

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

      {/* The gym's debts. Shown even when empty so it's clear nothing is
          hiding — the names Chris expects here (AMPAC, Pace, the US Bank card)
          have to exist as debts before they can be sorted into it. */}
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[13px] font-medium">Business Debt Secured</p>
          <p className="text-[13px] text-muted">{money(businessTotal)}</p>
        </div>
        {businessDebts.length > 0 ? (
          <div className="space-y-3">{businessDebts.map(row)}</div>
        ) : (
          <p className="text-xs text-muted">
            Nothing here yet. The gym&apos;s accounts arrive from Money App and
            land in this section on their own.
          </p>
        )}
      </Card>

      {/* This year's headline. The years before it used to be listed here too,
          but they're the same rows the card below opens with — so they live in
          one place now instead of being scrolled past twice. */}
      <div
        className="rounded-2xl p-4 text-white"
        style={{
          background: "linear-gradient(135deg, #a56814 0%, #7d4a0b 100%)",
        }}
      >
        <p className="text-[13px] uppercase tracking-wide opacity-80">
          New debt added this year
        </p>
        <p className="text-3xl font-medium">
          {money(byYear.get(currentYear) ?? 0)}
        </p>
        <p className="mt-3 text-[13px] opacity-90">
          {owedSentence(cards, carLoans, personalLoans, total)}
        </p>
      </div>

      {/* Year by year: what got added, what it costs each month, and — once a
          year is opened — the months and transactions behind it. */}
      <DebtByYear
        transactions={txs}
        spending={spending}
        snapshots={snapshots}
        payMonths={payMonths}
        payProblem={payProblem}
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

      {/* Payoff what-if calculator. Jamie's own debts only — paying extra at
          the gym's loans isn't a plan he can act on. */}
      {personalDebts.length > 0 && (
        <PayoffCalculator
          debts={personalDebts}
          minTotal={minTotal}
          extra={extra}
          setExtra={setExtra}
        />
      )}


    </div>
  );
}

// ── The settlement terms ──────────────────────────────────────────────────────
// Admin-only. Chris sets what's owed, the rate and how long it runs; the monthly
// payment is worked out from those and shown as he types, so he can see what a
// rate or a term actually costs before saving it.
//
// Clearing all three puts the row back to the estimate rather than to zero, so
// an emptied form can't quietly tell Jamie he owes nothing.
function SettlementForm({
  current,
  estimate,
  onCancel,
  onSave,
}: {
  current: SettlementTerms;
  estimate: Debt; // the row as it reads with nothing set
  onCancel: () => void;
  onSave: (terms: SettlementTerms) => void;
}) {
  const text = (v: number | null) => (v === null ? "" : String(v));
  const [total, setTotal] = useState(text(current.total));
  const [apr, setApr] = useState(text(current.apr));
  const [years, setYears] = useState(
    current.months === null ? "" : String(current.months / 12),
  );

  // What's actually being typed, falling back to the estimate for anything left
  // blank — the same rule the row itself uses, so the preview is what he'll get.
  const num = (s: string, fallback: number) => {
    const n = Number(s.trim());
    return s.trim() && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const previewTotal = num(total, estimate.balance);
  const previewApr = num(apr, SETTLEMENT_APR);
  const previewMonths = Math.max(1, Math.round(num(years, SETTLEMENT_MONTHS / 12) * 12));
  const preview = monthlyPayment(previewTotal, previewApr, previewMonths);
  const interest = Math.max(0, preview * previewMonths - previewTotal);

  const blank = !total.trim() && !apr.trim() && !years.trim();

  function submit() {
    const parse = (s: string) => {
      const n = Number(s.trim());
      return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
    };
    const y = parse(years);
    onSave({
      total: parse(total),
      apr: parse(apr),
      months: y === null ? null : Math.max(1, Math.round(y * 12)),
    });
  }

  function keys(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="space-y-2 rounded-xl bg-tint p-3">
      <p className="text-[13px] font-medium">Divorce Settlement Loan</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Owed $</span>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none"
            placeholder={String(estimate.balance)}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            onKeyDown={keys}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Rate %</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none"
            placeholder="0"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            onKeyDown={keys}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Years</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none"
            placeholder={String(SETTLEMENT_MONTHS / 12)}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            onKeyDown={keys}
          />
        </label>
      </div>

      {/* The monthly isn't typed — it's what these three come to. */}
      <div className="rounded-lg bg-card p-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">Works out to</span>
          <span className="text-lg font-medium">{money(preview)}/mo</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {money(previewTotal)} over {duration(previewMonths)}
          {previewApr > 0
            ? ` at ${previewApr}% — ${money(interest)} of that is interest.`
            : " with no interest."}
        </p>
      </div>

      <p className="text-xs text-muted">
        {blank
          ? `Left empty, the row goes back to its estimate of ${money(estimate.balance)}.`
          : "Anything left empty uses the estimate for that number."}
      </p>
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
