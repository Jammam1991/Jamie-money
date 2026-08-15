"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Check,
  Pencil,
  Upload,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Gauge,
  Landmark,
  Settings,
  X,
  AlertCircle,
} from "lucide-react";
import { Card, Bar } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import {
  carLoanParts,
  duration,
  financeCharge,
  isCarLoan,
  isUnsecured,
  monthlyInterest,
  monthlyPayment,
  monthsToClear,
  simulate,
  TAYCAN_PRICE,
  totalBalance,
  totalMinimum,
} from "@/lib/payoff";
import { groupByCategory } from "@/lib/debtCategories";
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

// One colour per bucket, used by that bucket's dot, its slice of the bar at the
// top and the panel it opens — so a colour means the same thing everywhere on
// the page. Four distinct hues rather than one ramp, because these are four
// separate kinds of debt and not one thing at four sizes.
const VIOLET = "#6d28d9"; // Jamie's cards
const SKY = "#0369a1"; // Jamie's car
const AMBER = "#b45309"; // direct business debt
const ROSE = "#d1495a"; // personal debt used for business (Due to Chris)
const RED = "#b3261e"; // the settlement
const GREEN = "#167a5b";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

interface PersonalDebtItem {
  label: string;
  amount: number;
}

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
  currentMonth,
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
  currentMonth: string; // "YYYY-MM", the same shape transaction dates start with
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
  // Which of the four buckets is open. One at a time — the point of folding
  // them away is that the page fits on a screen.
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  // Which of the two "new debt" tiles is showing the charges behind it.
  const [openTile, setOpenTile] = useState<"month" | "year" | null>(null);
  const [openTools, setOpenTools] = useState(false);
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

  // Jamie's own debt, and only his. The year-by-year story and the payoff maths
  // are both about what he borrowed and what he can pay down, so the gym's
  // accounts stay out of them — they aren't his to pay, and their balance
  // history isn't mirrored here either, so counting them would move this year's
  // figure while every earlier year sat still.
  const total = totalBalance(personalDebts);
  const minTotal = totalMinimum(personalDebts);

  // The sections at the top, which do count everything that's owed.
  const businessTotal = totalBalance(businessDebts);
  // Hardcoded personal debt used for business (Due to Chris) — calculated in breakdown
  const dueToChrisItems: PersonalDebtItem[] = [
    { label: "SoFi personal loans", amount: 39000 },
    { label: "Kinecta line of credit", amount: 33000 },
    { label: "Credit cards", amount: 32000 },
    { label: "LOC draws & advances", amount: 25000 },
    { label: "Income borrowed", amount: 15000 },
    { label: "Other personal debt", amount: 9000 },
  ];
  const dueToChrisTotal = dueToChrisItems.reduce((s, item) => s + item.amount, 0);
  const securedTotal = total + settlement.balance + businessTotal + dueToChrisTotal;
  const securedMin = totalMinimum(debts) + settlement.minPayment;
  const securedInterest = monthlyInterest(debts);

  // The same money cut a different way: Jamie's own unsecured debt, his car,
  // the gym's debt, and the settlement — kept apart rather than lumped into
  // one "Unsecured" line, so a business balance never reads as Jamie's. These
  // still add up to the total exactly.
  //
  // Each one carries the debts behind it, so tapping a bucket opens the very
  // rows it was added up from. The whole list used to sit open on the page,
  // which meant scrolling past a dozen accounts to reach anything else.
  const personalUnsecuredDebts = personalDebts.filter(isUnsecured);
  const personalCarDebts = personalDebts.filter(isCarLoan);

  const breakdown = [
    {
      key: "personal-cards",
      emoji: "💳",
      color: VIOLET,
      label: "Jamie's cards",
      note: "cards and loans in Jamie's name",
      balance: totalBalance(personalUnsecuredDebts),
      monthly: totalMinimum(personalUnsecuredDebts),
      debts: personalUnsecuredDebts,
    },
    {
      key: "car",
      emoji: "🚗",
      color: SKY,
      label: "Jamie's car",
      note: "backed by the car itself",
      balance: totalBalance(personalCarDebts),
      monthly: totalMinimum(personalCarDebts),
      debts: personalCarDebts,
    },
    {
      key: "business",
      emoji: "🏋️",
      color: AMBER,
      label: "Direct business debt",
      note: "the gym's loans and cards",
      balance: businessTotal,
      monthly: totalMinimum(businessDebts),
      debts: businessDebts,
    },
    {
      key: "due-to-chris",
      emoji: "💰",
      color: ROSE,
      label: "Personal debt used for business",
      note: "borrowed and lent to the gym (Due to Chris)",
      balance: dueToChrisTotal,
      monthly: 0, // no structured monthly payment
      debts: [] as Debt[], // uses custom rendering with items
      items: dueToChrisItems,
    },
    {
      key: "divorce",
      emoji: "📄",
      color: RED,
      label: "Divorce settlement",
      // Flagged as not-final even once Chris has typed a figure. $200,000 is
      // the number being worked to, not a number anyone has signed — and a row
      // that just reads "what Jamie owes Chris" states it as settled fact.
      note:
        terms.total === null
          ? "an estimate (Actual To Be Determined)"
          : "what Jamie owes Chris (Actual To Be Determined)",
      balance: settlement.balance,
      monthly: settlement.minPayment,
      debts: [] as Debt[], // it has no rows — it opens its own panel instead
    },
    // Both direct and due-to-Chris rows show even at zero to be clear nothing
    // is hiding: the names Chris expects there need to exist as debts before
    // they can be sorted into them.
  ].filter((row) => row.balance > 0 || row.key === "business" || row.key === "due-to-chris");

  // New debt added this month and this year. Both come from the same list of
  // charges, so the two numbers can never disagree about what counts.
  //
  // tx_date is YYYY-MM-DD, so the year and the month are read off the front of
  // the string — `new Date()` would shift a January 1st charge into the year
  // before depending on the timezone.
  // Held as the lists rather than just the sums, because each tile opens onto
  // the very charges its number was added up from.
  const monthTxs = txs.filter((tx) => tx.txDate.startsWith(currentMonth));
  const yearTxs = txs.filter((tx) => tx.txDate.startsWith(String(currentYear)));
  const addedThisMonth = monthTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const addedThisYear = yearTxs.reduce((sum, tx) => sum + tx.amount, 0);

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
        <LoanParts debt={d} color={SKY} />
      </div>
    );
  }

  // The settlement, as the panel its bucket opens. It has no row in the
  // database — Chris either sets the figure or the page works one out from the
  // monthly amount — so it can't go through `row()` with the real debts.
  function settlementPanel() {
    if (editingSettlement) {
      return (
        <SettlementForm
          current={terms}
          estimate={settlementLoan(settlementMonthly, NO_TERMS)}
          onCancel={() => setEditingSettlement(false)}
          onSave={handleSaveSettlement}
        />
      );
    }
    return (
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
          {/* Not final either way. With nothing set the figure is the page's
              own guess; with a figure set it's the number being worked to, not
              one anyone has signed. The badge says which. */}
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white"
            style={{ background: RED }}
          >
            {terms.total === null ? "Estimated" : "Actual TBD"}
          </span>
          <span>
            {settlement.apr > 0 ? `${settlement.apr}% interest` : "no interest"} ·{" "}
            {money(settlement.minPayment)}/mo over{" "}
            {duration(terms.months ?? SETTLEMENT_MONTHS)}
          </span>
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {terms.total === null ? (
            <>
              A guess, not a number anyone agreed to:{" "}
              {money(settlement.minPayment)} a month over five years. The real
              figure comes out of the settlement.
            </>
          ) : (
            <>
              The actual is still to be determined. {money(settlement.balance)} is
              the figure being worked to, not one anyone has signed — it comes
              out of the settlement.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Everything owed, in one number — with what's been borrowed since the
          start of the month and the start of the year right underneath. Those
          two say whether the pile is still growing, which is the first thing
          anyone opening this page wants to know. */}
      <div
        className="rounded-2xl border p-5"
        style={{
          background: "linear-gradient(150deg, #fff6f2 0%, #ffeae4 55%, #f6ecfb 100%)",
          borderColor: "#f3d9d0",
        }}
      >
        <div className="text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted">
            Total debt
          </p>
          <p
            className="mt-1 text-[42px] font-black leading-none tracking-tight"
            style={{ color: RED }}
          >
            {money(securedTotal)}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            {money(securedMin)} a month to keep up · {money(securedInterest)} of
            that is pure interest
          </p>
        </div>

        {/* The two tiles open. Tapping one shows what the borrowing actually
            went on, grouped by heading, and each heading opens again to the
            charges themselves. One at a time — two panels of transactions
            inside a summary card defeats the point of the summary. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <NewDebtTile
            label="New debt this month"
            amount={addedThisMonth}
            count={monthTxs.length}
            open={openTile === "month"}
            onToggle={() => setOpenTile(openTile === "month" ? null : "month")}
          />
          <NewDebtTile
            label="New debt this year"
            amount={addedThisYear}
            count={yearTxs.length}
            open={openTile === "year"}
            onToggle={() => setOpenTile(openTile === "year" ? null : "year")}
          />
        </div>

        {openTile && (
          <NewDebtDrill
            txs={openTile === "month" ? monthTxs : yearTxs}
            period={openTile === "month" ? "this month" : `in ${currentYear}`}
          />
        )}
      </div>

      {/* The same total split by whose it is and what's behind it. These add up
          to the figure above exactly — nothing counted twice, nothing left out.
          Every account used to be listed on the page at once; now a row opens
          to show the accounts it was added up from. */}
      <Card>
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium">Where it&apos;s owed</p>
          <p className="text-[11px] text-muted">tap a row to open it</p>
        </div>

        {/* One bar, one colour per bucket: the shape of the pile at a glance. */}
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-tint">
          {breakdown.map((b) => (
            <div
              key={b.key}
              style={{
                width: `${(b.balance / (securedTotal || 1)) * 100}%`,
                background: b.color,
              }}
            />
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {breakdown.map((b) => {
            const open = openBucket === b.key;
            return (
              <div
                key={b.key}
                className="rounded-xl"
                style={{ background: `${b.color}14` }}
              >
                <button
                  className="flex w-full items-center gap-2.5 p-3 text-left"
                  onClick={() => setOpenBucket(open ? null : b.key)}
                  aria-expanded={open}
                >
                  <span className="text-[18px]">{b.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {b.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {b.note}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className="block text-[16px] font-bold leading-tight"
                      style={{ color: b.color }}
                    >
                      {money(b.balance)}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {money(b.monthly)}/mo
                    </span>
                  </span>
                  <ChevronDown
                    size={15}
                    className="shrink-0 text-muted transition-transform"
                    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>

                {open && (
                  <div
                    className="space-y-3 border-t p-3"
                    style={{ borderColor: `${b.color}33` }}
                  >
                    {b.key === "divorce" ? (
                      settlementPanel()
                    ) : b.key === "due-to-chris" && (b as any).items ? (
                      <div className="space-y-2">
                        {(b as any).items.map((item: PersonalDebtItem, i: number) => (
                          <div key={i} className="flex items-center justify-between py-2">
                            <span className="text-sm text-zinc-100">{item.label}</span>
                            <span className="font-medium text-zinc-100">
                              {money(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : b.debts.length > 0 ? (
                      b.debts.map(row)
                    ) : (
                      <p className="text-xs text-muted">
                        Nothing here yet. The gym&apos;s accounts arrive from Money
                        App and land in this section on their own.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

      {/* Credit score, last pulled from Money App */}
      {fico && <FicoCard score={fico.score} date={fico.date} />}

      {/* Year by year: what got added, what it costs each month, and — once a
          year is opened — the months and transactions behind it. Folded away by
          default; it's the longest thing on the page by far. */}
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

      {/* Pull debts straight from the bank or Money App (primary), with
          paste-a-report as backup. Admin plumbing, so it sits folded at the
          bottom rather than taking up four cards of the page. */}
      {admin &&
        (importing ? (
          <ImportPanel
            onCancel={() => setImporting(false)}
            onImport={handleImport}
          />
        ) : (
          <Card>
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setOpenTools((o) => !o)}
              aria-expanded={openTools}
            >
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <Settings size={15} />
                Where these numbers come from
              </span>
              <ChevronDown
                size={16}
                className={`text-muted transition-transform ${openTools ? "rotate-180" : ""}`}
              />
            </button>

            {openTools && (
              <div className="mt-3 space-y-2">
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
            )}
          </Card>
        ))}
    </div>
  );
}

// ── The two loans hiding inside the car loan ─────────────────────────────────
// One line on a statement, two different things owed: the Taycan, and the
// negative equity rolled in from the cars before it. The bar shows the split at
// a glance and each part carries its own share of the monthly payment.
//
// Nothing is estimated. Both parts sit in the same loan at the same rate over
// the same term, so the payment divides in exactly the same proportion as the
// balance — the two lines add back to the loan's own minimum to the dollar.
function LoanParts({ debt, color }: { debt: Debt; color: string }) {
  const parts = carLoanParts(debt);
  if (!parts) return null;

  const left = monthsToClear(debt.balance, debt.apr, debt.minPayment);
  const rolled = parts.find((p) => p.key === "rolled");

  return (
    <div className="mt-2.5 rounded-xl bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">
        What&apos;s inside this loan
      </p>

      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-tint">
        {parts.map((p) => (
          <div
            key={p.key}
            style={{
              width: `${(p.balance / debt.balance) * 100}%`,
              background: p.key === "taycan" ? color : RED,
            }}
          />
        ))}
      </div>

      <div className="mt-2.5 space-y-2.5">
        {parts.map((p) => (
          <div key={p.key} className="flex items-start gap-2">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: p.key === "taycan" ? color : RED }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">
                {p.emoji} {p.label}
              </span>
              <span className="block text-[11px] text-muted">{p.note}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[14px] font-semibold leading-tight">
                {money(p.balance)}
              </span>
              <span className="block text-[11px] text-muted">
                {money(p.monthly)}/mo
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 border-t border-border pt-2.5 text-[11px] text-muted">
        {rolled && (
          <>
            {money(rolled.monthly)} of the {money(debt.minPayment)} payment —
            about {Math.round((rolled.balance / debt.balance) * 100)}% of it — is
            still paying off cars that are already gone.{" "}
          </>
        )}
        {left !== null && <>Both parts run out together in {duration(left)}. </>}
        The Taycan is counted at {money(TAYCAN_PRICE)}; the rest is what was
        carried over from earlier trade-ins.
      </p>
    </div>
  );
}

// ── "New debt this month / this year" ────────────────────────────────────────
// Red when the pile grew, green when more went back than went out. A month
// where Jamie paid down more than he borrowed is good news, and a bare
// "-$1,200" buried it — so it gets said in words as well as colour.
//
// A tile with no charges behind it doesn't pretend to open.
function NewDebtTile({
  label,
  amount,
  count,
  open,
  onToggle,
}: {
  label: string;
  amount: number;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const grew = amount > 0;
  const tone = grew ? RED : GREEN;
  return (
    <button
      type="button"
      className="rounded-xl border bg-white/70 p-3 text-left disabled:cursor-default"
      style={{ borderColor: open ? tone : "transparent" }}
      onClick={onToggle}
      disabled={count === 0}
      aria-expanded={count > 0 ? open : undefined}
    >
      <span className="block text-[11px] text-muted">{label}</span>
      <span
        className="mt-0.5 block text-[22px] font-black leading-tight"
        style={{ color: tone }}
      >
        {grew ? "+" : ""}
        {money(Math.abs(amount))}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-muted">
        {count === 0
          ? "nothing borrowed"
          : `${count} charge${count === 1 ? "" : "s"} — tap to see`}
        {count > 0 && (
          <ChevronDown
            size={11}
            className="transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        )}
      </span>
    </button>
  );
}

// ── Where the new debt went ──────────────────────────────────────────────────
// The charges behind a tile, grouped by what they look like they were for, then
// each heading opens onto the charges themselves — payee, date and the account
// it landed on, which is what a line gets checked against on a statement.
//
// The headings are worked out from the payee name and nothing else, so the card
// says so rather than presenting a guess as a fact. Every real charge is still
// listed underneath: the grouping only decides what sits next to what.
function NewDebtDrill({ txs, period }: { txs: DebtTransaction[]; period: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = groupByCategory(txs);
  const total = groups.reduce((sum, g) => sum + Math.abs(g.total), 0) || 1;

  return (
    <div className="mt-2 rounded-xl border border-white/60 bg-white/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">
        What it went on, {period}
      </p>

      <div className="mt-2 space-y-1.5">
        {groups.map((g) => {
          const open = openKey === g.category.key;
          const paidBack = g.total < 0;
          return (
            <div
              key={g.category.key}
              className="overflow-hidden rounded-lg"
              style={{ background: g.category.tint }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                onClick={() => setOpenKey(open ? null : g.category.key)}
                aria-expanded={open}
              >
                <span className="text-[15px]">{g.category.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {g.category.label}
                  </span>
                  {/* How big this heading is next to the others. */}
                  <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-white/70">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(Math.abs(g.total) / total) * 100}%`,
                        background: g.category.color,
                      }}
                    />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className="block text-[13px] font-semibold leading-tight"
                    style={{ color: paidBack ? GREEN : g.category.color }}
                  >
                    {paidBack ? "−" : ""}
                    {money(Math.abs(g.total))}
                  </span>
                  <span className="block text-[10px] text-muted">
                    {g.items.length} charge{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronDown
                  size={13}
                  className="shrink-0 text-muted transition-transform"
                  style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </button>

              {open && (
                <ul className="space-y-2 px-2.5 pb-2.5 pl-9">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">
                          {t.description}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {t.txDate}
                        </span>
                        {t.source && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                            <Landmark size={10} className="shrink-0" />
                            <span className="truncate">{t.source}</span>
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right text-[13px]">
                        {t.amount < 0 ? (
                          <>
                            {money(Math.abs(t.amount))}
                            <span className="block text-[10px] text-muted">
                              paid back
                            </span>
                          </>
                        ) : (
                          money(t.amount)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] text-muted">
        The headings are worked out from the name on each charge, so one may sit
        under the wrong one. The charges themselves — and every total on this
        page — are exactly as they came from Money App.
      </p>
    </div>
  );
}

// ── Credit score ─────────────────────────────────────────────────────────────
// The number, what it means in words, and where it sits on the 300–850 scale —
// so a score reads as a position rather than as three digits on their own.
//
// The whole card is a link to the Credit Report page. The score is the summary
// of what's on that page, so tapping it is the obvious next question: which
// accounts made it this number?
function FicoCard({ score, date }: { score: number; date: string }) {
  const color =
    score >= 740 ? GREEN : score >= 670 ? SKY : score >= 580 ? AMBER : RED;
  const pct = Math.max(0, Math.min(100, ((score - 300) / 550) * 100));

  return (
    <Link href="/credit-report" className="block">
      <Card>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <Gauge size={15} />
            Credit score
          </p>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ background: color }}
          >
            {ficoLabel(score)}
          </span>
        </div>
        <p className="mt-1 text-[34px] font-black leading-none" style={{ color }}>
          {score}
        </p>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-tint">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>300</span>
          <span>850</span>
        </div>
        <p className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
          <span>From Money App, updated {date}.</span>
          <span className="flex shrink-0 items-center gap-0.5" style={{ color }}>
            See the full report
            <ChevronRight size={13} />
          </span>
        </p>
      </Card>
    </Link>
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
