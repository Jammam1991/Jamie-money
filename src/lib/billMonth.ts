// The Bills page is forward-looking: money set aside now is for NEXT month's
// bills. By the middle of any month the bills due on the 1st and 5th have
// already come and gone, so a target for the current month is chasing money
// that's either spent or late. Everything on that page — the weekly target,
// the "paid" checkmarks, the headline — is anchored to the month returned
// here, and the home page's "enough for September's bills" goal matches it.
//
// A payment's `paid_date` records the month it COVERS, not always the day it
// left the bank; the note on the row carries the real date when the two differ.
// That convention already existed for settling late bills and is what lets a
// payment made in August count as September's.

const pad = (n: number) => String(n).padStart(2, "0");

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** First day of the month the Bills page is covering — next month. */
export function billMonthStart(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/** The month after that, i.e. the exclusive end of the covered month. */
export function billMonthEnd(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 2, 1);
}

/** `[start, end)` ISO bounds of the covered month, for date range queries. */
export function billMonthRange(from: Date = new Date()): {
  start: string;
  end: string;
} {
  return { start: iso(billMonthStart(from)), end: iso(billMonthEnd(from)) };
}

/** Name of the month the page covers, e.g. "September". */
export function billMonthName(from: Date = new Date()): string {
  return billMonthStart(from).toLocaleDateString("en-US", { month: "long" });
}

/**
 * The date to stamp on a payment that covers this month's bills: the bill's own
 * due day inside the covered month, clamped to a day that month actually has.
 * Anchoring to the due day (rather than "today") is what keeps a payment made
 * early, on time, or late all counted against the same bill.
 */
export function coveredPaidDate(dueDay: number, from: Date = new Date()): string {
  const start = billMonthStart(from);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const day = Math.min(Math.max(dueDay || 1, 1), lastDay);
  return iso(new Date(start.getFullYear(), start.getMonth(), day));
}
