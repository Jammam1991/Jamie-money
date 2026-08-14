import type { Debt } from "./data";

// ── Debt payoff math ──────────────────────────────────────────────────────────
// Plain-English idea: we pretend to pay the debts month by month. Every month
// interest is added on, then Jamie's payment comes off. Any spare money after
// the minimums goes at the debt with the highest interest first (the
// "avalanche" method — the cheapest way to get out of debt).

const MAX_MONTHS = 1200; // 100 years — a safety stop so we never loop forever.

// The level payment that clears `total` over `months` at `apr` — the standard
// amortisation formula. At 0% it's just the total split evenly, which the
// formula itself can't do (it divides by zero).
//
// Lives here rather than in a component because two screens now ask the same
// question of different numbers: what Jamie owes Chris on the Debt page, and
// what the gym investment would cost to pay back on The Big Picture. One
// formula means the two can't quietly disagree.
export function monthlyPayment(total: number, apr: number, months: number): number {
  if (months <= 0) return total;
  const r = apr / 100 / 12;
  if (r === 0) return total / months;
  return (total * r) / (1 - Math.pow(1 + r, -months));
}

export type SimResult = {
  months: number; // how many months until everything is paid off
  totalInterest: number; // total interest paid along the way
  paysOff: boolean; // false if the payment is too small to ever clear it
};

// What one debt costs to carry for a month — the finance charge a statement
// would show. It's the part of a payment that buys nothing: pay exactly this
// and the balance hasn't moved.
export function financeCharge(debt: Debt): number {
  return debt.balance * (debt.apr / 100 / 12);
}

// ── Splitting the pile into the kinds worth naming ───────────────────────────
// Money App tags each account, so its rows sort themselves. Rows typed in by
// hand carry no tag, so they fall back to reading the name — rough, but the
// alternative is leaving them out of a total that claims to be everything.
//
// A closed card that's now a fixed loan is a personal loan, not a card, even
// though its name still says "Card". Money App's tag is what decides that, so
// the name check is only ever a last resort for untagged rows.

function looksLikeCarLoan(name: string): boolean {
  return /\b(car|auto|vehicle)\b/i.test(name);
}

function looksLikeCard(name: string): boolean {
  if (looksLikeCarLoan(name) || /\bloan\b/i.test(name)) return false;
  return /\b(card|amex|visa|mastercard)\b/i.test(name);
}

function looksLikePersonalLoan(name: string): boolean {
  return /\bloan\b/i.test(name) && !looksLikeCarLoan(name);
}

// ── Secured or not ───────────────────────────────────────────────────────────
// Secured means there's something behind the debt the lender can take back if
// it stops being paid — the car, the house. Everything else is unsecured: the
// cards and the loans with nothing but a signature behind them.
//
// Money App's tag decides it where there is one; the name checks are the last
// resort for rows typed in by hand.
export function isCarLoan(debt: Debt): boolean {
  return debt.debtType
    ? debt.debtType === "auto_loan"
    : looksLikeCarLoan(debt.name);
}

export function isSecured(debt: Debt): boolean {
  return isCarLoan(debt) || debt.debtType === "mortgage";
}

export function isUnsecured(debt: Debt): boolean {
  return !isSecured(debt);
}

// What's owed on credit cards.
export function cardBalance(debts: Debt[]): number {
  return debts
    .filter((d) =>
      d.debtType ? d.debtType === "credit_card" : looksLikeCard(d.name),
    )
    .reduce((sum, d) => sum + d.balance, 0);
}

// What's owed on car loans.
export function carLoanBalance(debts: Debt[]): number {
  return debts.filter(isCarLoan).reduce((sum, d) => sum + d.balance, 0);
}

// What's owed on personal loans — including the closed cards that have since
// turned into fixed loans.
export function personalLoanBalance(debts: Debt[]): number {
  return debts
    .filter((d) =>
      d.debtType ? d.debtType === "personal_loan" : looksLikePersonalLoan(d.name),
    )
    .reduce((sum, d) => sum + d.balance, 0);
}

// The interest Jamie is on track to pay next month if nothing changes.
export function monthlyInterest(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + financeCharge(d), 0);
}

// The smallest total monthly payment allowed (sum of every minimum).
export function totalMinimum(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.minPayment, 0);
}

export function totalBalance(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.balance, 0);
}

// Pay `monthlyBudget` in total across all debts each month and see what happens.
export function simulate(debts: Debt[], monthlyBudget: number): SimResult {
  const rows = debts.map((d) => ({
    bal: d.balance,
    rate: d.apr / 100 / 12, // monthly interest rate
    min: d.minPayment,
  }));

  let totalInterest = 0;
  let months = 0;

  while (rows.some((r) => r.bal > 0.01) && months < MAX_MONTHS) {
    months++;

    // 1) Add this month's interest.
    for (const r of rows) {
      if (r.bal > 0) {
        const interest = r.bal * r.rate;
        r.bal += interest;
        totalInterest += interest;
      }
    }

    let budget = monthlyBudget;

    // 2) Cover the minimum on each debt first.
    for (const r of rows) {
      if (r.bal <= 0 || budget <= 0) continue;
      const pay = Math.min(r.min, r.bal, budget);
      r.bal -= pay;
      budget -= pay;
    }

    // 3) Throw any leftover money at the highest-interest debt.
    const order = rows.filter((r) => r.bal > 0).sort((a, b) => b.rate - a.rate);
    for (const r of order) {
      if (budget <= 0) break;
      const pay = Math.min(budget, r.bal);
      r.bal -= pay;
      budget -= pay;
    }
  }

  const paysOff = rows.every((r) => r.bal <= 0.01);
  return { months, totalInterest, paysOff };
}

// How long `payment` a month takes to clear `balance` at `apr` — the
// amortisation formula run the other way round. Null when the payment doesn't
// even cover the interest, because then it never clears at all.
export function monthsToClear(
  balance: number,
  apr: number,
  payment: number,
): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;
  const r = apr / 100 / 12;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
}

// ── What's actually inside the car loan ──────────────────────────────────────
// The US Bank loan isn't one purchase. Roughly $60,000 of it bought the Taycan;
// everything above that is negative equity rolled in from the cars before it —
// money still owed on trade-ins that were worth less than the loans against
// them. One loan on a statement, two very different things owed.
//
// The split is worth showing because the two halves mean different things. The
// Taycan half bought something that exists and can be sold. The rolled-in half
// bought nothing — it's the last cars still being paid for, quietly riding
// along inside this one.
//
// Both halves sit in one loan at one rate over one term, so the payment splits
// in exactly the same proportion as the balance. Nothing here is estimated:
// it's the same $2,093 written as two lines that add back to it.
export const TAYCAN_PRICE = 60_000;

export type LoanPart = {
  key: string;
  emoji: string;
  label: string;
  note: string;
  balance: number;
  monthly: number;
};

// Null when there's nothing to split — the loan isn't the car loan, or it has
// dropped to the point where it's all Taycan and no rolled-in equity.
//
// Matched on the name as well as the type on purpose. A second car loan one day
// would also be an "auto_loan", and splitting $60,000 of a Taycan out of a car
// that isn't the Taycan would be worse than not splitting at all. If Money App
// ever renames this account the split quietly stops, which is the safe way to
// be wrong.
export function carLoanParts(debt: Debt): LoanPart[] | null {
  if (!isCarLoan(debt)) return null;
  if (!/us\s*bank/i.test(debt.name)) return null;
  const car = Math.min(TAYCAN_PRICE, debt.balance);
  const rolled = debt.balance - car;
  if (rolled <= 0 || debt.balance <= 0) return null;

  const share = (amount: number) => (debt.minPayment * amount) / debt.balance;
  return [
    {
      key: "taycan",
      emoji: "🏎️",
      label: "The Taycan",
      note: "the car itself — this part bought something you still have",
      balance: car,
      monthly: share(car),
    },
    {
      key: "rolled",
      emoji: "📉",
      label: "Rolled in from earlier cars",
      note: "owed on cars already gone — this part bought nothing",
      balance: rolled,
      monthly: share(rolled),
    },
  ];
}

// Turn a number of months into "2 yrs 3 mo".
export function duration(months: number): string {
  if (!Number.isFinite(months) || months >= MAX_MONTHS) return "never";
  const y = Math.floor(months / 12);
  const m = Math.round(months % 12);
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} yr${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} mo`);
  if (parts.length === 0) return "0 mo";
  return parts.join(" ");
}
