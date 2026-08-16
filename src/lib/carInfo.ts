// ── Cars: the Taycan, its loan, and what came before it ─────────────────────
// The loan balance, APR and monthly payment all come live from the `debts`
// table — this file never stores a number that's already sitting there.
// Everything a loan can't tell you (mileage, insurance, warranty, an estimate
// of what the car is worth today) is Jamie's own typing, kept as one JSON row
// in `settings` — same pattern as Home Buying, so there's no table to create.

import type { Debt } from "./data";
import { carLoanParts, isCarLoan } from "./payoff";

export type CarInfo = {
  /** What the car itself cost — defaults to the Taycan split's $60,000. */
  purchasePrice: number;
  /** ISO date, e.g. "2024-03-01". Null means never entered. */
  purchaseDate: string | null;
  /** Odometer reading, last time it was checked. */
  mileage: number | null;
  mileageUpdatedAt: string | null;
  insuranceProvider: string;
  insuranceMonthly: number;
  insurancePolicyNumber: string;
  /** Pins the current value to a real number instead of the depreciation curve's guess. */
  estimatedValueOverride: number | null;
  warrantyExpires: string | null;
  warrantyMileageLimit: number | null;
  warrantyCoverage: string;
  /** A running total Jamie types in by hand — there's no maintenance log to read from. */
  maintenanceToDate: number;
};

export const DEFAULT_CAR_INFO: CarInfo = {
  purchasePrice: 60_000,
  purchaseDate: null,
  mileage: null,
  mileageUpdatedAt: null,
  insuranceProvider: "",
  insuranceMonthly: 0,
  insurancePolicyNumber: "",
  estimatedValueOverride: null,
  warrantyExpires: null,
  warrantyMileageLimit: null,
  warrantyCoverage: "",
  maintenanceToDate: 0,
};

// A previous car, typed in by hand — the app has no record of what Jamie
// drove before the Taycan, so this list starts empty and stays exactly what
// he puts into it.
export type CarHistoryEntry = {
  id: string;
  name: string;
  purchaseDate: string | null;
  soldDate: string | null;
  purchasePrice: number | null;
  tradeInValue: number | null;
  /** What was still owed on it when it was traded — the debt that rolled forward. */
  negativeEquity: number | null;
  notes: string;
};

// The car loan the rest of this page is about — the one with a Taycan split,
// or failing that, whichever loan on the debts list looks like a car.
export function primaryCarDebt(debts: Debt[]): Debt | null {
  const carDebts = debts.filter(isCarLoan);
  if (carDebts.length === 0) return null;
  return carDebts.find((d) => carLoanParts(d) !== null) ?? carDebts[0];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return (db - da) / (1000 * 60 * 60 * 24);
}

export function monthsBetween(a: string, b: string): number {
  return daysBetween(a, b) / 30.44;
}

function yearsBetween(a: string, b: string): number {
  return daysBetween(a, b) / 365.25;
}

// ── A rough guess at what it's worth today ───────────────────────────────────
// 20% off in the first year, 15% a year after that — a common rule of thumb
// for how a new car's value falls, not an appraisal. Never goes below a fifth
// of what it cost, because a car is always worth something. `estimatedValueOverride`
// exists so a real number (a trade-in quote, an appraisal) can replace this
// guess the moment Jamie has one.
export function depreciationEstimate(
  purchasePrice: number,
  purchaseDate: string | null,
  asOf: string,
): number {
  if (purchasePrice <= 0) return 0;
  if (!purchaseDate) return purchasePrice;
  const years = yearsBetween(purchaseDate, asOf);
  if (years <= 0) return purchasePrice;

  const wholeYears = Math.floor(years);
  const partialYear = years - wholeYears;
  let value = purchasePrice;
  for (let y = 0; y < wholeYears; y++) value *= y === 0 ? 0.8 : 0.85;
  if (partialYear > 0) {
    const rate = wholeYears === 0 ? 0.8 : 0.85;
    value *= 1 - (1 - rate) * partialYear;
  }
  return Math.max(value, purchasePrice * 0.2);
}

export function currentCarValue(info: CarInfo, asOf: string): number {
  return info.estimatedValueOverride ?? depreciationEstimate(info.purchasePrice, info.purchaseDate, asOf);
}

// ── What it's cost to own so far ─────────────────────────────────────────────
// Loan payments and insurance are only counted from the purchase date — before
// that, Jamie didn't own it. Maintenance has no source to read from, so it's
// just whatever running total he's typed in.
export type CarCostSummary = {
  monthsOwned: number;
  loanPaidToDate: number;
  insurancePaidToDate: number;
  maintenanceToDate: number;
  total: number;
};

export function carCostSummary(
  info: CarInfo,
  monthlyLoanPayment: number,
  asOf: string,
): CarCostSummary {
  const monthsOwned = info.purchaseDate
    ? Math.max(0, Math.round(monthsBetween(info.purchaseDate, asOf)))
    : 0;
  const loanPaidToDate = monthlyLoanPayment * monthsOwned;
  const insurancePaidToDate = info.insuranceMonthly * monthsOwned;
  return {
    monthsOwned,
    loanPaidToDate,
    insurancePaidToDate,
    maintenanceToDate: info.maintenanceToDate,
    total: loanPaidToDate + insurancePaidToDate + info.maintenanceToDate,
  };
}
