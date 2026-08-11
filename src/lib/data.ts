// Sample data for Jamie's app.
// This is placeholder content so the pages have something to show.
// Later, these values get filled from Jamie's real bank feed (Plaid) and his
// Supabase database — the shape stays the same, only the source changes.

// One line in Jamie's cash log — the heart of the simple home screen.
// 'massage' puts cash IN his pocket; the other three take cash OUT.
export type CashKind = "massage" | "to_chris" | "deposit" | "spent";

export type CashEntry = {
  id: string;
  kind: CashKind;
  amount: number; // always positive; `kind` decides in vs out
  happenedOn: string; // ISO date, e.g. "2026-07-29"
  note?: string;
};

// How each kind shows up on screen. `direction` is +1 (cash in) or -1 (cash out).
export const CASH_KINDS: Record<
  CashKind,
  { emoji: string; label: string; doneLabel: string; direction: 1 | -1 }
> = {
  massage: { emoji: "💆", label: "I did a massage", doneLabel: "Massage", direction: 1 },
  to_chris: { emoji: "🤝", label: "Gave cash to Chris", doneLabel: "Gave to Chris", direction: -1 },
  deposit: { emoji: "🏦", label: "Put cash in the bank", doneLabel: "Put in bank", direction: -1 },
  spent: { emoji: "🛒", label: "Spent some cash", doneLabel: "Spent", direction: -1 },
};

// The running balance: massages add, everything else subtracts.
export function cashBalance(entries: CashEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + CASH_KINDS[e.kind].direction * e.amount,
    0
  );
}

export type Debt = {
  id: string;
  name: string;
  balance: number;
  monthly: number; // kept for the existing monthly-payment display
  paidPct: number; // 0-100
  apr: number; // yearly interest rate as a percent, e.g. 22.9
  minPayment: number; // smallest payment allowed each month
  // What kind of debt it is, straight from Money App: "credit_card",
  // "auto_loan", "mortgage", "personal_loan", "student_loan",
  // "line_of_credit" or "other". Missing on rows typed in by hand.
  debtType?: string;
};

// A single recurring bill Jamie owes (rent, phone, etc.).
export type Bill = {
  id: string;
  name: string;
  amount: number; // dollars per month
  dueDay: number; // day of the month it's due (1-31), 0 = no set day
  fico: boolean; // true = a credit card, so paying it moves his credit score
};

// A single manually-logged payment against a bill.
export type BillPayment = {
  id: string;
  billId: string;
  amount: number;
  paidDate: string; // ISO date, e.g. "2026-07-01"
  note?: string;
};

// A stored file (lease/agreement PDF) attached to a bill. `url` is a
// short-lived signed download link generated at read time, not persisted.
export type BillDocument = {
  id: string;
  billId: string;
  fileName: string;
  uploadedAt: string; // ISO datetime
  url: string | null;
};

export type Divorce = {
  support: { amount: number; nextDate: string; paidThisMonth: boolean };
  split: { item: string; note: string }[];
  benefits: string[];
  keyDates: { label: string; date: string }[];
  documentsCount: number;
};

export type OwesCharge = {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO date, e.g. "2026-07-01"
  paid: boolean;
};

// A few sample cash-log lines so demo/disconnected mode isn't a blank state.
export const sampleCashLog: CashEntry[] = [
  { id: "1", kind: "massage", amount: 80, happenedOn: "2026-07-28" },
  { id: "2", kind: "massage", amount: 100, happenedOn: "2026-07-27" },
  { id: "3", kind: "to_chris", amount: 60, happenedOn: "2026-07-26" },
  { id: "4", kind: "massage", amount: 80, happenedOn: "2026-07-25" },
];

export const debts: Debt[] = [
  { id: "1", name: "Credit card", balance: 5800, monthly: 150, paidPct: 38, apr: 22.9, minPayment: 150 },
  { id: "2", name: "Car loan", balance: 6500, monthly: 320, paidPct: 55, apr: 7.5, minPayment: 320 },
  { id: "3", name: "Loan from friend", balance: 2000, monthly: 100, paidPct: 20, apr: 0, minPayment: 100 },
];

export const debtFreeBy = "early 2028";

// Common monthly bills, preloaded so the Bills page has something to show.
// Jamie can edit, delete, or add to these.
export const bills: Bill[] = [
  { id: "1", name: "Rent", amount: 1200, dueDay: 1, fico: false },
  { id: "2", name: "Car payment", amount: 320, dueDay: 5, fico: true },
  { id: "3", name: "Car insurance", amount: 140, dueDay: 10, fico: false },
  { id: "4", name: "Phone", amount: 70, dueDay: 12, fico: false },
  { id: "5", name: "Internet", amount: 60, dueDay: 15, fico: false },
  { id: "6", name: "Utilities", amount: 180, dueDay: 18, fico: false },
  { id: "7", name: "Groceries", amount: 400, dueDay: 0, fico: false },
  { id: "8", name: "Subscriptions", amount: 45, dueDay: 20, fico: false },
];

// A couple of sample payments so demo/disconnected mode isn't a blank state.
export const samplePayments: Record<string, BillPayment[]> = {
  "1": [
    { id: "1", billId: "1", amount: 1200, paidDate: "2026-06-01" },
    { id: "2", billId: "1", amount: 1200, paidDate: "2026-05-01" },
  ],
};

// Jamie's typical weekly take-home from massage work (starter value).
export const weeklyIncome = 900;

// Average number of weeks in a month — used to turn a monthly total into a
// weekly target.
export const WEEKS_PER_MONTH = 4.33;

export const divorce: Divorce = {
  support: { amount: 900, nextDate: "Aug 1", paidThisMonth: true },
  split: [
    { item: "Loans", note: "$37,046 — TBD" },
    { item: "Auto Loans", note: "$112,833 — TBD" },
    { item: "Beacon HELOC", note: "$199,368 — TBD" },
    { item: "Other Debt", note: "$22,330 — TBD" },
  ],
  benefits: [
    "Joint tax discount",
    "Health benefits",
    "$250K life insurance",
    "Special programs",
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

// Same as money() but keeps the cents — used where a real bill statement is
// copied line for line and rounding would change the numbers.
export function moneyExact(n: number): string {
  const sign = n < 0 ? "-" : "";
  return (
    sign +
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export const owesChris: OwesCharge[] = [
  { id: "1", description: "SoCal Gas", amount: 25, date: "2026-07-15", paid: false },
  { id: "2", description: "Car Insurance", amount: 275, date: "2026-07-10", paid: false },
  { id: "3", description: "Health Benefits (July)", amount: 200, date: "2026-07-01", paid: false },
];
