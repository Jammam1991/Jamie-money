// Sample data for Jamie's app.
// This is placeholder content so the pages have something to show.
// Later, these values get filled from Jamie's real bank feed (Plaid) and his
// Supabase database — the shape stays the same, only the source changes.

export type Txn = {
  id: string;
  name: string;
  kind: "coffee" | "groceries" | "pay" | "bill" | "other";
  amount: number; // negative = money out, positive = money in
};

export type Summary = {
  statusLabel: string;
  statusNote: string;
  netWorth: number;
  netWorthChange: number; // this month, + or -
  moneyIn: number;
  moneyOut: number;
  recent: Txn[];
};

export type Debt = {
  id: string;
  name: string;
  balance: number;
  monthly: number;
  paidPct: number; // 0-100
};

export type Divorce = {
  support: { amount: number; nextDate: string; paidThisMonth: boolean };
  lawyerCostsSoFar: number;
  split: { item: string; note: string }[];
  keyDates: { label: string; date: string }[];
  documentsCount: number;
};

export const summary: Summary = {
  statusLabel: "You're doing okay",
  statusNote: "You spent a little less than usual this week.",
  netWorth: 48200,
  netWorthChange: 600,
  moneyIn: 3100,
  moneyOut: 2540,
  recent: [
    { id: "1", name: "Pay", kind: "pay", amount: 1550 },
    { id: "2", name: "Groceries", kind: "groceries", amount: -62.1 },
    { id: "3", name: "Coffee", kind: "coffee", amount: -4.5 },
  ],
};

export const debts: Debt[] = [
  { id: "1", name: "Credit card", balance: 5800, monthly: 150, paidPct: 38 },
  { id: "2", name: "Car loan", balance: 6500, monthly: 320, paidPct: 55 },
  { id: "3", name: "Loan from friend", balance: 2000, monthly: 100, paidPct: 20 },
];

export const debtFreeBy = "early 2028";

export const divorce: Divorce = {
  support: { amount: 900, nextDate: "Aug 1", paidThisMonth: true },
  lawyerCostsSoFar: 3200,
  split: [
    { item: "House", note: "50 / 50" },
    { item: "Savings", note: "50 / 50" },
    { item: "Car", note: "Yours" },
  ],
  keyDates: [
    { label: "Court date", date: "Sep 12" },
    { label: "Papers due", date: "Aug 20" },
  ],
  documentsCount: 4,
};

export function money(n: number): string {
  const rounded = Math.round(n);
  return "$" + rounded.toLocaleString("en-US");
}

export function moneyCents(n: number): string {
  return (
    (n < 0 ? "-$" : "+$") +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
