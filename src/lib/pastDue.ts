import type { CashEntry, OwesCharge } from "./data";

// The thermometer fills up to here. When it's full, the app goes into
// "emergency mode". Jamie never sees this number — only the thermometer.
export const EMERGENCY_AT = 3000;

// First day of the month we're in right now, as "YYYY-MM-01".
// Anything Chris covered BEFORE this date that still isn't paid back is late.
// So August's charges only become past due once September starts.
export function monthStart(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export type OpenCharge = OwesCharge & { remaining: number; late: boolean };

export type PastDue = {
  amount: number; // still owed from months that already ended
  thisMonth: number; // still owed from the current month — not late yet
  stillOwed: number; // amount + thisMonth
  chargesTotal: number;
  givenTotal: number;
  openCharges: OpenCharge[]; // oldest first, only what's still unpaid
};

export function computePastDue(
  charges: OwesCharge[],
  givenEntries: CashEntry[],
  cutoff: string = monthStart()
): PastDue {
  const chargesTotal = charges.reduce((s, c) => s + (c.paid ? 0 : c.amount), 0);
  const givenTotal = givenEntries.reduce((s, e) => s + e.amount, 0);

  // Cash Jamie hands over pays off the OLDEST charges first, so a payment
  // clears his late months before it touches the current one.
  let credit = givenTotal;
  const openCharges = charges
    .filter((c) => !c.paid)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => {
      const applied = Math.min(credit, c.amount);
      credit -= applied;
      return { ...c, remaining: c.amount - applied, late: c.date < cutoff };
    })
    .filter((c) => c.remaining > 0.005);

  const amount = openCharges
    .filter((c) => c.late)
    .reduce((s, c) => s + c.remaining, 0);
  const thisMonth = openCharges
    .filter((c) => !c.late)
    .reduce((s, c) => s + c.remaining, 0);

  return {
    amount,
    thisMonth,
    stillOwed: amount + thisMonth,
    chargesTotal,
    givenTotal,
    openCharges,
  };
}
