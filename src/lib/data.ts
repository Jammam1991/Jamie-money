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

export type Bill = {
  id: string;
  name: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  dueDate?: string;
};

export type Divorce = {
  support: { amount: number; nextDate: string; paidThisMonth: boolean };
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

export const bills: Bill[] = [
  { id: "1", name: "Electric", amount: 120, frequency: "monthly", dueDate: "1st" },
  { id: "2", name: "Internet", amount: 85, frequency: "monthly", dueDate: "5th" },
  { id: "3", name: "Streaming", amount: 18, frequency: "monthly", dueDate: "15th" },
];

export const divorce: Divorce = {
  support: { amount: 900, nextDate: "Aug 1", paidThisMonth: true },
  split: [
    { item: "House", note: "50 / 50" },
    { item: "Savings", note: "50 / 50" },
    { item: "Car", note: "Yours" },
  ],
  keyDates: [
    { label: "Tentative divorce initiation", date: "Aug 15" },
    { label: "Court date (tentative)", date: "Jan 15" },
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
