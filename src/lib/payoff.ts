import type { Debt } from "./data";

// ── Debt payoff math ──────────────────────────────────────────────────────────
// Plain-English idea: we pretend to pay the debts month by month. Every month
// interest is added on, then Jamie's payment comes off. Any spare money after
// the minimums goes at the debt with the highest interest first (the
// "avalanche" method — the cheapest way to get out of debt).

const MAX_MONTHS = 1200; // 100 years — a safety stop so we never loop forever.

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

// ── Splitting the pile into the two kinds worth naming ───────────────────────
// Money App tags each account, so its rows sort themselves. Rows typed in by
// hand carry no tag, so they fall back to reading the name — rough, but the
// alternative is leaving them out of a total that claims to be everything.

function looksLikeCard(name: string): boolean {
  return /\b(card|amex|visa|mastercard)\b/i.test(name);
}

function looksLikeCarLoan(name: string): boolean {
  return /\b(car|auto|vehicle)\b/i.test(name);
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
  return debts
    .filter((d) =>
      d.debtType ? d.debtType === "auto_loan" : looksLikeCarLoan(d.name),
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
