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
  newDebtMonthlyCost,
  simulate,
  TAYCAN_PRICE,
  totalBalance,
  totalMinimum,
} from "@/lib/payoff";
import { groupByCategory } from "@/lib/debtCategories";
import { CARRY_CATEGORIES, type ChrisCarry } from "@/lib/chrisCarry";
import { SECURITY_DEPOSIT } from "@/lib/offsets";
import { DEFAULT_SPLIT_PCT, gymShareFigures } from "@/lib/monthlyExtras";
import { parseReportText, type ParsedDebt } from "@/lib/parseReport";
import { extractPdfText } from "@/lib/pdfText";
import PlaidConnect from "@/components/PlaidConnect";
import MoneyAppConnect from "@/components/MoneyAppConnect";
import DuplicateCleanup from "@/components/DuplicateCleanup";
import DebtByYear from "@/components/DebtByYear";
import BusinessPayMonth from "@/components/BusinessPayMonth";
import type {
  DebtSnapshotRow,
  DebtTransaction,
  InvestmentSplitTerms,
  SettlementTerms,
} from "@/lib/store";
import type { PayMonth } from "@/lib/gymPay";
import {
  addDebt,
  addDebtTransaction,
  deleteDebt,
  deleteDebtTransaction,
  importDebts,
  setInvestmentSplitTerms,
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
const TEAL = "#0d7d73"; // Jamie's share of the gym investment, owed to Chris

// The month before "YYYY-MM". Done on the string rather than with a Date, so
// stepping back from January can't land in the wrong year via a timezone.
function previousMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

// "2026-08" → "August". Read straight off the string for the same reason as
// previousMonth: building a Date from a month key and formatting it can slide
// into the month before, depending on the timezone the page renders in.
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

function monthName(key: string): string {
  const month = Number(key.split("-")[1]);
  return MONTH_NAMES[month - 1] ?? key;
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

interface PersonalDebtItem {
  label: string;
  amount: number;
}

// ── What comes back off the pile ─────────────────────────────────────────────
// Two kinds of thing, and the difference matters, so they're kept apart.
//
// The gym's security deposit reduces what went INTO the gym, and what went in
// is what Chris and Jamie split — so it lowers Jamie's share by half of itself,
// not all of it. It lives in the investment list below and must not be
// subtracted a second time further down the page.
//
// The Rolex and the medical payment are Jamie's own: one is an asset bought
// with the debt that could be sold, the other is money owed to him that hasn't
// landed. Both come off his total in full.
//
// None of this money has moved yet, which is why it sits beside the total
// rather than inside it. A headline that quietly assumes a watch sells and a
// payment arrives is not what Jamie owes today.

type Offset = {
  key: string;
  emoji: string;
  label: string;
  note: string;
  amount: number;
};

const OFFSETS: Offset[] = [
  {
    key: "rolex",
    emoji: "⌚",
    label: "Rolex",
    note: "bought with the debt \u2014 selling it pays that much back",
    amount: 25000,
  },
  {
    key: "medical",
    emoji: "🩺",
    label: "Medical payment coming",
    note: "owed to Jamie, not arrived yet",
    amount: 20000,
  },
];

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
  investmentSplitTerms,
  chrisCarry,
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
  investmentSplitTerms: InvestmentSplitTerms; // what % of the gym investment is Jamie's; null falls back to 50/50
  chrisCarry: ChrisCarry; // what Chris really pays each month on the money he lent the gym
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
  // What Chris set Jamie's share of the gym investment to. Same pattern as the
  // settlement: null means "no figure set", not "zero" — so it falls back to
  // the 50/50 default instead of quietly telling Jamie he owes nothing.
  const [splitTerms, setSplitTerms] = useState<InvestmentSplitTerms>(investmentSplitTerms);
  const [editingSplit, setEditingSplit] = useState(false);
  // Which of the four buckets is open. One at a time — the point of folding
  // them away is that the page fits on a screen.
  const [openBucket, setOpenBucket] = useState<string | null>(null);
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
    ...CARRY_CATEGORIES.map((c) => ({ label: c.label, amount: c.balance })),
    // Due back from the gym's landlord. It belongs here rather than with the
    // things that come off Jamie's total, because it reduces what went into the
    // gym — and what went in is what gets split. So it cuts Jamie's share by
    // half of itself, and can't be counted again lower down.
    { label: "Security deposit coming back", amount: -SECURITY_DEPOSIT },
  ];
  const dueToChrisTotal = dueToChrisItems.reduce((s, item) => s + item.amount, 0);

  // What Jamie owes Chris for his half of the gym investment, on top of the
  // business loans already in his own name.
  //
  // Chris and Jamie split what's gone into the gym — the direct business debt
  // plus the personal money Chris put in — by a percentage Chris sets here.
  // Jamie's $52,423 in business loans already counts as part of his share, so
  // only what's left after that comes out of the $153,000 Chris is personally
  // carrying. Nothing new is being borrowed: this is that same $153,000, split
  // by who it's really for.
  const splitPct = splitTerms.splitPct ?? DEFAULT_SPLIT_PCT;
  const totalInvestment = businessTotal + dueToChrisTotal;
  const jamieInvestmentShare = totalInvestment * (splitPct / 100);

  // The row used to read "$0/mo", as though Jamie's share of the gym cost
  // nothing to carry. It isn't free — Chris services it every month out of his
  // own accounts — so his real payments come across from Money App and Jamie
  // takes the same slice of them that he takes of the balance.
  //
  // Same ratio as the balance on purpose: he owes $35,288 of the $123,000 Chris
  // is carrying, so he owes that fraction of the cost of carrying it. Anything
  // else would be a second, different split nobody agreed to.
  const gymShare = gymShareFigures({
    businessTotal,
    dueToChrisTotal,
    splitPct,
    chrisCarryMonthly: chrisCarry.monthly,
  });
  const jamieOwesChris = gymShare.balance;
  const jamieCarryShare = gymShare.share;
  const jamieMonthlyToChris = gymShare.monthly;
  const chrisRemainingShare = dueToChrisTotal - jamieOwesChris;

  // ── Carrying now, and the settlement kept out of it ────────────────────────
  // Everything owed, the settlement included. Kept because the settlement card
  // needs to say what the two figures come to together — but it is NOT what
  // the headline shows.
  const owedIncludingSettlement =
    total + settlement.balance + businessTotal + jamieOwesChris;

  // What Jamie is actually carrying: the same money without the divorce
  // settlement. The settlement is deferred — not his to pay right now — and a
  // headline that folds it in tells him he owes $54,000 more this month than
  // he does. It gets its own card underneath instead, so nothing is hidden;
  // it just stops inflating the number he plans around.
  const carryingTotal = owedIncludingSettlement - settlement.balance;

  // Same cut on the monthly side: every payment except the settlement's.
  const monthlyTotal = totalMinimum(debts) + jamieMonthlyToChris;
  const monthlyIncludingSettlement = monthlyTotal + settlement.minPayment;

  // What's left once the things coming back are counted. The deposit is
  // already inside the total above — it came off the gym investment — so only
  // the Rolex and the medical payment come off again here.
  //
  // Netted off the carrying total, not off everything, so "owed today" in that
  // card means the same thing as the headline right above it.
  const offsetTotal = OFFSETS.reduce((sum, o) => sum + o.amount, 0);
  const netTotal = carryingTotal - offsetTotal;

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
      label: "Spending Debt",
      // No sub-line: the name says it. An empty note drops the row's second
      // line rather than leaving a blank one.
      note: "",
      balance: totalBalance(personalUnsecuredDebts),
      monthly: totalMinimum(personalUnsecuredDebts),
      debts: personalUnsecuredDebts,
      items: [] as PersonalDebtItem[],
    },
    {
      key: "car",
      emoji: "🚗",
      color: SKY,
      label: "Auto Debt",
      note: "backed by the car itself",
      balance: totalBalance(personalCarDebts),
      monthly: totalMinimum(personalCarDebts),
      debts: personalCarDebts,
      items: [] as PersonalDebtItem[],
    },
    {
      key: "business",
      emoji: "🏋️",
      color: AMBER,
      label: "Business Debt",
      note: "",
      balance: businessTotal,
      monthly: totalMinimum(businessDebts),
      debts: businessDebts,
      items: [] as PersonalDebtItem[],
    },
    {
      key: "due-to-chris",
      emoji: "💰",
      color: ROSE,
      label: "Business Debt — owed to Chris",
      // The balance is Jamie's cut, not Chris's whole carry — the $153,000
      // Chris personally put in only becomes Jamie's debt after the split and
      // after netting out what Jamie already carries in his own name
      // (businessTotal). Showing the raw $153,000 here double-counted it
      // against the split math below.
      note: `${splitPct}% of what's gone into the gym`,
      balance: jamieOwesChris,
      // Jamie's slice of what Chris really pays each month. Zero only when
      // Money App is unreachable or nothing matched — the panel says which.
      monthly: jamieMonthlyToChris,
      debts: [] as Debt[], // uses custom rendering — see the split panel below
      items: dueToChrisItems,
    },
    // The divorce settlement used to sit here as a fifth row. It has its own
    // card below now: it's deferred, and a deferred debt listed alongside the
    // ones being paid every month reads as another bill to find.
    //
    // Business and owed-to-Chris rows show even at zero to be clear nothing is
    // hiding: the names Chris expects there need to exist as debts before
    // they can be sorted into them.
  ].filter((row) => row.balance > 0 || row.key === "business" || row.key === "due-to-chris");

  // New debt added this month and this year. Both come from the same list of
  // charges, so the two numbers can never disagree about what counts.
  //
  // tx_date is YYYY-MM-DD, so the year and the month are read off the front of
  // the string — `new Date()` would shift a January 1st charge into the year
  // before depending on the timezone.
  // Held as the lists rather than just the sums, because each card opens onto
  // the very rows its number was added up from.
  //
  // New debt is two different things and they were never shown together. Chris
  // lending money privately is one. Jamie drawing more out of the gym than the
  // work earned is the other — Chris puts the difference in, so it's borrowed
  // just the same, and it only ever appeared buried in the year-by-year card.
  const lastMonth = previousMonth(currentMonth);
  const periods = {
    month: {
      loans: txs.filter((t) => t.txDate.startsWith(currentMonth)),
      pay: payMonths.filter((p) => p.month.startsWith(currentMonth)),
    },
    last: {
      loans: txs.filter((t) => t.txDate.startsWith(lastMonth)),
      pay: payMonths.filter((p) => p.month.startsWith(lastMonth)),
    },
    year: {
      loans: txs.filter((t) => t.txDate.startsWith(String(currentYear))),
      pay: payMonths.filter((p) => p.month.startsWith(String(currentYear))),
    },
  };

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

  // Null clears Chris's figure and puts the split back on the 50/50 default.
  function handleSaveSplit(next: InvestmentSplitTerms) {
    const previous = splitTerms;
    setSplitTerms(next);
    setEditingSplit(false);
    startTransition(async () => {
      const res = await setInvestmentSplitTerms(next);
      if (!res.ok) setSplitTerms(previous);
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

  // Jamie's share of the investment, as the panel its bucket opens. Walked out
  // in plain steps rather than just stated as a number — this is money he's
  // being told he owes, and the whole point of the row is that he can see
  // exactly where it came from without having to ask.
  function splitPanel() {
    if (editingSplit) {
      return (
        <SplitForm
          current={splitTerms}
          onCancel={() => setEditingSplit(false)}
          onSave={handleSaveSplit}
        />
      );
    }
    const otherPct = 100 - splitPct;
    return (
      <div>
        <div className="flex items-center justify-between font-medium">
          <span>Split {splitPct}/{otherPct} with Chris</span>
          {admin && (
            <button
              aria-label="Edit the split"
              className="text-muted"
              onClick={() => setEditingSplit(true)}
            >
              <Pencil size={15} />
            </button>
          )}
        </div>

        {/* The math, one plain step at a time — so the total at the bottom is
            never just a number to take on faith. */}
        <div className="mt-2 space-y-1.5 rounded-lg bg-card p-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Direct business debt (your name)</span>
            <span>{money(businessTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">+ Personal money Chris put in</span>
            <span>{money(dueToChrisTotal)}</span>
          </div>
          <div className="space-y-1 border-l pl-2.5" style={{ borderColor: `${TEAL}33` }}>
            {dueToChrisItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-[11px] text-muted">
                <span>{item.label}</span>
                {/* money() puts the sign after the dollar sign — "$-30,000" —
                    which reads as a typo. Money coming back gets its minus in
                    front and the colour the rest of the page uses for good
                    news. */}
                <span style={item.amount < 0 ? { color: GREEN } : undefined}>
                  {item.amount < 0
                    ? `\u2212${money(Math.abs(item.amount))}`
                    : money(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 font-medium">
            <span>= Total put into the gym</span>
            <span>{money(totalInvestment)}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted">× Your share ({splitPct}%)</span>
            <span>{money(jamieInvestmentShare)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">− Already in your name</span>
            <span>−{money(businessTotal)}</span>
          </div>
          <div
            className="flex items-center justify-between border-t border-border pt-1.5 font-semibold"
            style={{ color: TEAL }}
          >
            <span>= What you still owe Chris</span>
            <span>{money(jamieOwesChris)}</span>
          </div>
        </div>

        {/* What carrying it costs each month. The balance above is what Jamie
            owes; this is what it costs Chris to hold it, and Jamie's slice of
            that. Shown with the working because it's a figure nobody could
            otherwise check. */}
        <CarryCost
          carry={chrisCarry}
          share={jamieCarryShare}
          jamieMonthly={jamieMonthlyToChris}
        />

        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          This is your {splitPct}% of what&apos;s gone into the gym, minus the{" "}
          {money(businessTotal)} in loans already in your own name. Chris is
          still personally carrying the other {money(chrisRemainingShare)} of
          the {money(dueToChrisTotal)} above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* What this month has cost so far, leading the page. The total further
          down is the standing figure; this is the one that changes week to
          week, and it's what says whether the pile is still growing right now.

          Both halves of "new debt" sit in here: what Chris lent privately, and
          what Jamie drew out of the gym above what the work earned. The second
          only ever appeared buried in the year-by-year card, so a month could
          read as quiet while thousands went out that way.

          The monthly figure beside it is the point of the card: borrowing is
          not a one-off cost. Every dollar added here turns into a payment that
          comes back every month afterwards, and that's the half a plain
          "+$2,474" never said. */}
      <NewDebtCard
        big
        label={`${monthName(currentMonth)} New Debt`}
        loans={periods.month.loans}
        pay={periods.month.pay}
        debts={debts}
      />

      <div className="grid grid-cols-2 gap-3">
        <NewDebtCard
          label={`${monthName(lastMonth)}'s New Debt`}
          loans={periods.last.loans}
          pay={periods.last.pay}
          debts={debts}
        />
        <NewDebtCard
          label={`New debt in ${currentYear} so far`}
          loans={periods.year.loans}
          pay={periods.year.pay}
          debts={debts}
        />
      </div>

      {/* The same total split by whose it is and what's behind it. These add up
          to the figure above exactly — nothing counted twice, nothing left out.
          Every account used to be listed on the page at once; now a row opens
          to show the accounts it was added up from. */}
      <Card>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Total balance
            </p>
            <p className="text-[30px] font-black leading-none">
              {money(carryingTotal)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Total monthly payment
            </p>
            <p className="text-[30px] font-black leading-none">
              {money(monthlyTotal)}/mo
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[12px] text-muted">
          What you&apos;re carrying now · {money(securedInterest)} of the
          payment is pure interest
        </p>
        {/* Says out loud what the headline leaves out, so a number that got
            smaller can't read as debt quietly going away. */}
        {settlement.balance > 0 && (
          <p className="mt-1 text-[12px] text-muted">
            The {money(settlement.balance)} divorce settlement is deferred and
            sits in its own card below.
          </p>
        )}
        {offsetTotal > 0 && (
          <p className="mt-1 text-[12px]" style={{ color: GREEN }}>
            {money(netTotal)}{" "}once what&apos;s coming back lands — see below
          </p>
        )}

        {/* One bar, one colour per bucket: the shape of the pile at a glance. */}
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-tint">
          {breakdown.map((b) => (
            <div
              key={b.key}
              style={{
                width: `${(b.balance / (carryingTotal || 1)) * 100}%`,
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
                  {/* Wrapping rather than truncating: "Business Debt — owed to
                      Chris" is the whole point of that row, and cutting it to
                      "Business Debt — ow…" on a phone loses which one it is. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">
                      {b.label}
                    </span>
                    {b.note && (
                      <span className="block text-[11px] text-muted">
                        {b.note}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[16px] font-bold leading-tight">
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
                    ) : b.key === "due-to-chris" ? (
                      splitPanel()
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

      {/* ── The settlement, on its own ───────────────────────────────────────
          Out of the headline because it's deferred, and in a card of its own
          rather than deleted because it's still money owed. Kept visually
          apart from the rows above: those are bills arriving this month, this
          one isn't, and the whole point of moving it was to stop the two
          reading as the same kind of thing. */}
      {settlement.balance > 0 && (
        <Card>
          {/* Title and badge on their own line, figures underneath. Side by
              side, the long title and "$900/mo when it starts" fight for the
              same 375px and both wrap raggedly. */}
          <button
            className="w-full text-left"
            onClick={() =>
              setOpenBucket(openBucket === "divorce" ? null : "divorce")
            }
            aria-expanded={openBucket === "divorce"}
          >
            <span className="flex items-start gap-2.5">
              <span className="text-[18px]">📄</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="text-[15px] font-medium">
                    Divorce Settlement Debt
                  </span>
                  <span className="rounded bg-tint px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    Deferred
                  </span>
                </span>
              </span>
              <ChevronDown
                size={15}
                className="mt-1 shrink-0 text-muted transition-transform"
                style={{
                  transform:
                    openBucket === "divorce" ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              />
            </span>

            <span className="mt-2.5 grid grid-cols-2 gap-3 border-t border-border pt-2.5">
              <span className="block">
                <span className="block text-[20px] font-black leading-none">
                  {money(settlement.balance)}
                </span>
                <span className="mt-1 block text-[11px] text-muted">
                  owed in total
                </span>
              </span>
              <span className="block">
                <span className="block text-[20px] font-black leading-none">
                  {money(settlement.minPayment)}
                  <span className="text-[13px] font-bold">/mo</span>
                </span>
                <span className="mt-1 block text-[11px] text-muted">
                  when it starts
                </span>
              </span>
            </span>
          </button>

          {openBucket === "divorce" && (
            <div className="mt-3 border-t border-border pt-3">
              {settlementPanel()}

              {/* What the two cards come to together, so the money taken out
                  of the headline is still added back somewhere on the page. */}
              <div className="mt-3 space-y-1 border-t border-border pt-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Carrying now</span>
                  <span>{money(carryingTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">+ Deferred settlement</span>
                  <span>{money(settlement.balance)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                  <span>= Owed in total</span>
                  <span>{money(owedIncludingSettlement)}</span>
                </div>
                <p className="pt-1 text-[11px] text-muted">
                  With the settlement it would be{" "}
                  {money(monthlyIncludingSettlement)} a month rather than{" "}
                  {money(monthlyTotal)}.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* What comes back off the pile. Its own card rather than netted into the
          total above, because none of this money has moved yet. */}
      <OffsetsCard
        gross={carryingTotal}
        net={netTotal}
        offsets={OFFSETS}
        deposit={SECURITY_DEPOSIT}
        depositShare={SECURITY_DEPOSIT * (splitPct / 100)}
        splitPct={splitPct}
      />

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

// ── What carrying the gym debt costs each month ──────────────────────────────
// The balance above is what Jamie owes. This is what it costs to hold that
// money, and Jamie's slice of the cost.
//
// The whole thing is shown with its working. The figure is built out of Chris's
// own accounts in Money App, matched by name to the categories of what he lent
// the gym, so the only way Jamie can judge it is by seeing which accounts went
// into it and what they cost. It also says what it does NOT cover: two of the
// six categories have no lender behind them at all.
function CarryCost({
  carry,
  share,
  jamieMonthly,
}: {
  carry: ChrisCarry;
  share: number;
  jamieMonthly: number;
}) {
  const [open, setOpen] = useState(false);
  const covered = carry.lines.filter((l) => l.matchedBalance > 0);

  if (carry.problem || covered.length === 0) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        {carry.problem ??
          "None of Chris's accounts matched this money, so what it costs to carry each month isn't known."}
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-card p-2.5">
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1 text-[13px] text-muted">
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          />
          Your share of carrying it
        </span>
        <span className="text-[15px] font-semibold">
          {money(jamieMonthly)}/mo
        </span>
      </button>

      {open && (
        <>
          <div className="mt-2 space-y-1 text-[11px]">
            {covered.map((l) => (
              <div key={l.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">{l.label}</span>
                  <span>{money(l.monthly)}/mo</span>
                </div>
                {/* Which real accounts this came from, so the line can be
                    checked against a statement rather than trusted. */}
                <p className="flex items-start gap-1 text-[10px] text-faint">
                  <Landmark size={9} className="mt-0.5 shrink-0" />
                  <span className="truncate">{l.accounts.join(", ")}</span>
                </p>
                {/* Chris carries personal debt on these accounts too, so only
                    the part that went to the gym is counted. */}
                {l.matchedBalance > l.balance && (
                  <p className="text-[10px] text-faint">
                    {money(l.balance)} of the {money(l.matchedBalance)} on{" "}
                    {l.accounts.length === 1 ? "that account" : "those accounts"}{" "}
                    went to the gym, so that much of the payment is counted.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1 border-t border-border pt-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">Chris pays each month</span>
              <span>{money(carry.monthly)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">
                × your share ({Math.round(share * 1000) / 10}%)
              </span>
              <span>{money(jamieMonthly)}</span>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-muted">
            Your share here is the same fraction as the balance — you owe{" "}
            {Math.round(share * 1000) / 10}% of what Chris is carrying, so you
            owe that much of what it costs him to carry it.
            {carry.uncoveredBalance > 0 && (
              <>
                {" "}
                It doesn&apos;t cover {money(carry.uncoveredBalance)} of the
                total: income Chris didn&apos;t take and other personal debt have
                no lender and no monthly payment behind them.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

// ── What comes back off the pile ─────────────────────────────────────────────
// Assets that could be sold, and money owed to Jamie that hasn't landed. Shown
// beside the total rather than folded into it: none of this has happened yet,
// and a smaller headline that quietly assumes a watch sells and a payment
// arrives is not what Jamie owes today.
//
// The security deposit is listed too, but greyed and marked as already counted.
// It came off what went into the gym, so it has already shrunk Jamie's share by
// half of itself further up the page. Listing it here without saying that would
// subtract it twice; leaving it out entirely would leave "where did the deposit
// go?" unanswered.
function OffsetsCard({
  gross,
  net,
  offsets,
  deposit,
  depositShare,
  splitPct,
}: {
  gross: number;
  net: number;
  offsets: Offset[];
  deposit: number;
  depositShare: number;
  splitPct: number;
}) {
  const [open, setOpen] = useState(false);
  const total = offsets.reduce((sum, o) => sum + o.amount, 0);
  if (total <= 0) return null;

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between gap-3"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="min-w-0 text-left">
          <span className="block text-[11px] uppercase tracking-wide text-muted">
            What comes off it
          </span>
          <span
            className="block text-[26px] font-black leading-none"
            style={{ color: GREEN }}
          >
            −{money(total)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-right">
            <span className="block text-[11px] text-muted">would leave</span>
            <span className="block text-[16px] font-bold">{money(net)}</span>
          </span>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <>
          <div className="mt-3 space-y-2">
            {offsets.map((o) => (
              <div
                key={o.key}
                className="flex items-start gap-2.5 rounded-xl p-2.5"
                style={{ background: "var(--good-bg)" }}
              >
                <span className="text-[17px]">{o.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{o.label}</span>
                  <span className="block text-[11px] text-muted">{o.note}</span>
                </span>
                <span
                  className="shrink-0 text-[15px] font-bold"
                  style={{ color: GREEN }}
                >
                  −{money(o.amount)}
                </span>
              </div>
            ))}

            {/* Already counted further up — greyed, and it says where it went. */}
            <div className="flex items-start gap-2.5 rounded-xl bg-tint p-2.5">
              <span className="text-[17px] opacity-60">🔑</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-muted">
                  Security deposit coming back
                </span>
                <span className="block text-[11px] text-muted">
                  already taken off what went into the gym — {money(depositShare)}{" "}
                  of it is Jamie&apos;s, being his {splitPct}% share
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-bold text-muted">
                −{money(deposit)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1 border-t border-border pt-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">Owed today</span>
              <span>{money(gross)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">− Assets and money coming</span>
              <span style={{ color: GREEN }}>−{money(total)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
              <span>= If all of it lands</span>
              <span>{money(net)}</span>
            </div>
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            None of this has happened yet — the watch has to sell and the payment
            has to arrive. So the headline above stays at what&apos;s owed today,
            and this is what it would become.
          </p>
        </>
      )}
    </Card>
  );
}

// ── New debt over a stretch of time ──────────────────────────────────────────
// The card behind "this month", "last month" and "this year so far". Same
// component all three times, so the three numbers are always worked out the
// same way and can't quietly drift apart.
//
// New debt is two different things, and until now the page only counted one:
//
//   1. What Chris lent privately — the charges mirrored from Money App.
//   2. What Jamie drew out of the gym above what the work earned. Chris puts
//      that difference in, so it's borrowed just the same. It used to appear
//      only inside the year-by-year card, which meant a month could read as
//      quiet while thousands went out that way.
//
// Red when the pile grew, green when more went back than went out. A month
// where Jamie paid down more than he borrowed is good news and a bare
// "-$1,200" buried it, so it gets said in words as well as colour.
function NewDebtCard({
  label,
  loans,
  pay,
  big = false,
  debts,
}: {
  label: string;
  loans: DebtTransaction[];
  pay: PayMonth[];
  big?: boolean;
  // Only the lead card passes these, and only to work out what the new
  // borrowing costs each month from here on. Left off, the card is exactly
  // what it was.
  debts?: Debt[];
}) {
  const [open, setOpen] = useState(false);
  const [openPart, setOpenPart] = useState<string | null>(null);

  const lent = loans.reduce((sum, t) => sum + t.amount, 0);
  const overdrawn = pay.reduce((sum, p) => sum + p.difference, 0);
  const total = lent + overdrawn;
  const grew = total > 0;
  const tone = grew ? "#18181b" : GREEN;

  // What this month's borrowing adds to the bill every month from now on.
  // Worked out at the same rate Jamie's own cards already charge him — see
  // newDebtMonthlyCost. Null when there's nothing to work that rate out from,
  // and the figure is left off rather than guessed at.
  const monthlyCost =
    debts && total !== 0 ? newDebtMonthlyCost(Math.abs(total), debts) : null;

  // A half with nothing in it drops out rather than sitting there as "$0" —
  // except when both are empty, and then the card just says nothing happened.
  const parts = [
    {
      key: "loans",
      emoji: "🤝",
      color: VIOLET,
      tint: "#f1ecfd",
      label: "Chris lent you privately",
      note: "money Chris put in directly",
      amount: lent,
      count: loans.length,
    },
    {
      key: "pay",
      emoji: "🏋️",
      color: AMBER,
      tint: "#fbf1e2",
      label: "Took more than you earned",
      note: "drawn from the gym above what the work was worth",
      amount: overdrawn,
      count: pay.length,
    },
  ].filter((p) => p.count > 0 && p.amount !== 0);

  const nothing = parts.length === 0;

  // Only the lead card has the width to put the two figures in a row.
  const sideBySide = monthlyCost !== null && big;

  return (
    <div
      className="rounded-2xl border"
      style={{
        background: big
          ? "linear-gradient(150deg, #fff6f2 0%, #ffeae4 55%, #f6ecfb 100%)"
          : "var(--card)",
        borderColor: big ? "#f3d9d0" : "var(--border)",
      }}
    >
      <button
        type="button"
        className="w-full p-4 text-left disabled:cursor-default"
        onClick={() => setOpen((o) => !o)}
        disabled={nothing}
        aria-expanded={nothing ? undefined : open}
      >
        <span
          className={`block text-muted ${big ? "text-[12px] font-medium uppercase tracking-[0.18em]" : "text-[11px]"}`}
        >
          {label}
        </span>

        {/* The amount borrowed and what it costs from here on. One is what
            happened over the period; the other is what it keeps costing — and
            the second is the one that never got said.

            Side by side only on the lead card, which has the full width for
            it. The two small cards are half a phone wide already, so splitting
            them again leaves about 75px a column and neither figure fits. */}
        <span
          className={
            sideBySide ? "mt-1 grid grid-cols-2 items-start gap-3" : "mt-1 block"
          }
        >
          <span className="block min-w-0">
            <span
              className={`block font-black leading-none tracking-tight ${
                // Sharing the row with the /mo figure halves the room, and
                // "+$35,893" at 40px does not fit half a phone. It keeps the
                // full size whenever it has the width to itself.
                big ? (sideBySide ? "text-[30px]" : "text-[40px]") : "text-[24px]"
              }`}
              style={{ color: nothing ? "var(--muted)" : tone }}
            >
              {grew ? "+" : ""}
              {money(Math.abs(total))}
            </span>
            <span
              className={`mt-1.5 block text-muted ${big ? "text-[12px]" : "text-[11px]"}`}
            >
              {nothing ? "nothing borrowed" : grew ? "borrowed" : "paid off"}
            </span>
          </span>

          {sideBySide && (
            <span className="block min-w-0">
              <span className="block text-[22px] font-black leading-none tracking-tight">
                {grew ? "+" : "−"}
                {money(monthlyCost)}
                <span className="text-[13px] font-bold">/mo</span>
              </span>
              <span className="mt-1.5 block text-[12px] text-muted">
                {grew ? "added to" : "off"} the monthly payment
              </span>
            </span>
          )}
        </span>

        {/* On the small cards the same figure runs on one wrapping line —
            the number carries the weight, the words stay quiet. */}
        {monthlyCost !== null && !sideBySide && (
          <span className="mt-1.5 block text-[11px]">
            <span className="text-[13px] font-bold">
              {grew ? "+" : "−"}
              {money(monthlyCost)}/mo
            </span>{" "}
            <span className="text-muted">
              {grew ? "added to the payment" : "off the payment"}
            </span>
          </span>
        )}

        {/* The way in, on its own line so it never competes with the figures
            above it for room. */}
        {!nothing && (
          <span
            className={`mt-2 flex items-center gap-1 text-muted ${big ? "text-[12px]" : "text-[11px]"}`}
          >
            tap for the detail
            <ChevronDown
              size={12}
              className="transition-transform"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </span>
        )}
      </button>

      {open && !nothing && (
        <div className="space-y-1.5 px-4 pb-4">
          {parts.map((part) => {
            const partOpen = openPart === part.key;
            const back = part.amount < 0;
            return (
              <div
                key={part.key}
                className="overflow-hidden rounded-xl"
                style={{ background: part.tint }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                  onClick={() => setOpenPart(partOpen ? null : part.key)}
                  aria-expanded={partOpen}
                >
                  <span className="text-[16px]">{part.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">
                      {part.label}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {part.note}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className="block text-[14px] font-bold leading-tight"
                      style={{ color: back ? GREEN : part.color }}
                    >
                      {back ? "−" : ""}
                      {money(Math.abs(part.amount))}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {part.count}{" "}
                      {part.key === "loans"
                        ? `charge${part.count === 1 ? "" : "s"}`
                        : `month${part.count === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <ChevronDown
                    size={13}
                    className="shrink-0 text-muted transition-transform"
                    style={{
                      transform: partOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    }}
                  />
                </button>

                {partOpen && (
                  <div className="px-2.5 pb-2.5">
                    {part.key === "loans" ? (
                      <LentDetail txs={loans} />
                    ) : (
                      <OverdrawnDetail months={pay} />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {parts.length === 2 && (
            <p className="pt-1 text-[11px] text-muted">
              Both halves are borrowed money: Chris either handed it over or
              covered the shortfall out of the gym. Together they come to{" "}
              {money(Math.abs(total))}.
            </p>
          )}

          {/* Where the /mo figure came from. It isn't billed by anyone yet, so
              the card has to say how it was worked out rather than let it read
              as a number off a statement. */}
          {monthlyCost !== null && (
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              The {money(monthlyCost)}/mo is an estimate. Nobody has set a
              payment on this money yet, so it&apos;s costed at the same rate
              Jamie&apos;s own cards already charge him.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── What Chris lent, and what it went on ─────────────────────────────────────
// Grouped by what each charge looks like it was for, then each heading opens
// onto the charges themselves — payee, date and the account it landed on, which
// is what a line gets checked against on a statement.
//
// The headings are worked out from the payee name and nothing else, so the
// panel says so rather than presenting a guess as a fact. Every real charge is
// still listed underneath: the grouping only decides what sits next to what.
function LentDetail({ txs }: { txs: DebtTransaction[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = groupByCategory(txs);
  const total = groups.reduce((sum, g) => sum + Math.abs(g.total), 0) || 1;

  return (
    <div className="rounded-lg bg-card p-2.5">
      <div className="space-y-1.5">
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
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                onClick={() => setOpenKey(open ? null : g.category.key)}
                aria-expanded={open}
              >
                <span className="text-[14px]">{g.category.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">
                    {g.category.label}
                  </span>
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
                    className="block text-[12px] font-semibold leading-tight"
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
                  size={12}
                  className="shrink-0 text-muted transition-transform"
                  style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </button>

              {open && (
                <ul className="space-y-2 px-2 pb-2 pl-8">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[12px]">
                          {t.description}
                        </span>
                        <span className="block text-[10px] text-muted">
                          {t.txDate}
                        </span>
                        {t.source && (
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                            <Landmark size={10} className="shrink-0" />
                            <span className="truncate">{t.source}</span>
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right text-[12px]">
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

      <p className="mt-2 text-[10px] text-muted">
        The headings are worked out from the name on each charge, so one may sit
        under the wrong one. The charges themselves are exactly as they came from
        Money App.
      </p>
    </div>
  );
}

// ── What was drawn out of the gym above what it earned ───────────────────────
// One row per month: what the work was worth, what was actually taken, and the
// gap Chris covered. A month where less came out than was earned shows as such
// rather than as a negative gap nobody can read.
function OverdrawnDetail({ months }: { months: PayMonth[] }) {
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const ordered = [...months].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="space-y-2 rounded-lg bg-card p-2.5">
      {ordered.map((m) => {
        const over = m.difference > 0;
        const open = openMonth === m.month;
        return (
          <div key={m.month}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setOpenMonth(open ? null : m.month)}
              aria-expanded={open}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1 text-[12px] font-medium">
                  <ChevronDown
                    size={11}
                    className={`shrink-0 text-muted transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
                  />
                  {m.label}
                </span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: over ? AMBER : GREEN }}
                >
                  {over ? "+" : "−"}
                  {money(Math.abs(m.difference))}
                </span>
              </span>
              <span className="block pl-4 text-[10px] text-muted">
                earned {money(m.earned)} · took {money(m.took)} ·{" "}
                {over
                  ? "Chris put in the difference"
                  : "took less than the work was worth"}
              </span>
              {/* A month still running has only part of its earnings in, while
                  a draw taken at the start of it is already counted in full.
                  The gym dashboard pro-rates on purpose — the management fee
                  accrues day by day, a session counts once it has happened — so
                  the gap always reads high mid-month and shrinks as the month
                  finishes. The row says so rather than presenting a
                  half-finished month as a settled one. */}
              {m.isCurrentMonth && (
                <span className="mt-0.5 block pl-4 text-[10px]" style={{ color: AMBER }}>
                  Still running — earnings only count up to today, so this gap
                  will shrink as the month finishes.
                </span>
              )}
            </button>

            {open && <BusinessPayMonth pay={m} />}
          </div>
        );
      })}
      <p className="border-t border-border pt-2 text-[10px] text-muted">
        Earnings come from the gym dashboard and the draws from Money App.
        Neither is typed in by hand. Open a month to check either against the
        sessions and transfers behind it.
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
    score >= 740 ? GREEN : score >= 670 ? SKY : score >= 580 ? AMBER : "#a1a1a1";
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
        <p className="mt-1 flex items-center justify-end gap-2 text-xs text-muted">
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

function SplitForm({
  current,
  onCancel,
  onSave,
}: {
  current: InvestmentSplitTerms;
  onCancel: () => void;
  onSave: (terms: InvestmentSplitTerms) => void;
}) {
  const [pct, setPct] = useState(current.splitPct === null ? "" : String(current.splitPct));

  function submit() {
    const n = Number(pct.trim());
    const clean = pct.trim() && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
    onSave({ splitPct: clean });
  }

  function keys(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="space-y-2 rounded-xl bg-tint p-3">
      <p className="text-[13px] font-medium">Jamie&apos;s share of the investment</p>
      <label className="block">
        <span className="mb-1 block text-[11px] text-muted">Jamie&apos;s share, %</span>
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          min={0}
          max={100}
          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none"
          placeholder="50"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          onKeyDown={keys}
        />
      </label>
      <p className="text-xs text-muted">Left empty, the split goes back to 50/50.</p>
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
