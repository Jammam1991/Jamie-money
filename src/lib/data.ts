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
  monthly: number; // kept for the existing monthly-payment display
  paidPct: number; // 0-100
  apr: number; // yearly interest rate as a percent, e.g. 22.9
  minPayment: number; // smallest payment allowed each month
};

// A single recurring bill Jamie owes (rent, phone, etc.).
export type Bill = {
  id: string;
  name: string;
  amount: number; // dollars per month
  dueDay: number; // day of the month it's due (1-31), 0 = no set day
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
  { id: "1", name: "Credit card", balance: 5800, monthly: 150, paidPct: 38, apr: 22.9, minPayment: 150 },
  { id: "2", name: "Car loan", balance: 6500, monthly: 320, paidPct: 55, apr: 7.5, minPayment: 320 },
  { id: "3", name: "Loan from friend", balance: 2000, monthly: 100, paidPct: 20, apr: 0, minPayment: 100 },
];

export const debtFreeBy = "early 2028";

// Common monthly bills, preloaded so the Bills page has something to show.
// Jamie can edit, delete, or add to these.
export const bills: Bill[] = [
  { id: "1", name: "Rent", amount: 1200, dueDay: 1 },
  { id: "2", name: "Car payment", amount: 320, dueDay: 5 },
  { id: "3", name: "Car insurance", amount: 140, dueDay: 10 },
  { id: "4", name: "Phone", amount: 70, dueDay: 12 },
  { id: "5", name: "Internet", amount: 60, dueDay: 15 },
  { id: "6", name: "Utilities", amount: 180, dueDay: 18 },
  { id: "7", name: "Groceries", amount: 400, dueDay: 0 },
  { id: "8", name: "Subscriptions", amount: 45, dueDay: 20 },
];

// Jamie's typical weekly take-home from massage work (starter value).
export const weeklyIncome = 900;

// Average number of weeks in a month — used to turn a monthly total into a
// weekly target.
export const WEEKS_PER_MONTH = 4.33;

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
