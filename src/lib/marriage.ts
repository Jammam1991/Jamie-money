import { client } from "./store";
import { getTaxFilingResults } from "./taxCenter";

// ── Married vs Divorce ───────────────────────────────────────────────────────
// What staying married is actually worth in dollars — and, just as important,
// what it has nothing to do with.
//
// Four things carry real money: the joint tax return, the car insurance
// discount, the life cover Jamie is named on, and the health cover Comerica
// pays most of. Only the first can be read from somewhere — the Tax Center feed
// already works out what each year would have cost filed as two single returns,
// so that number is real rather than typed.
//
// The other three are things only Chris knows, so Chris types them. They live
// as one JSON row in the existing key/value `settings` table, the same way
// `household_income` does, so there's no setup SQL to run before this page
// works.
//
// Blank is not zero. A missing figure means "not filled in yet", which the page
// says out loud instead of quietly counting it as nothing.

export const MARRIAGE_BENEFITS_KEY = "marriage_benefits";

export type MarriageBenefits = {
  /** What the married / two-people-one-policy discount knocks off, per year. */
  carSavingYearly: number | null;
  /** The life cover Jamie is named on through Chris's policy. A range,
   *  because what pays out depends on which policy pays it. */
  lifeCoverLow: number | null;
  lifeCoverHigh: number | null;
  /** The full monthly cost of Jamie's health cover, before Comerica's share. */
  healthPremiumMonthly: number | null;
  /** The percent of that premium Comerica pays. */
  healthEmployerPct: number | null;
};

// What the page starts with before Chris has typed anything. The two figures
// that are already known get real defaults; the two that aren't stay blank so
// the page asks for them rather than inventing them.
export const DEFAULT_MARRIAGE_BENEFITS: MarriageBenefits = {
  carSavingYearly: null,
  lifeCoverLow: 200_000,
  lifeCoverHigh: 300_000,
  healthPremiumMonthly: null,
  healthEmployerPct: 75,
};

function positive(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function getMarriageBenefits(): Promise<MarriageBenefits> {
  const c = client();
  if (!c) return DEFAULT_MARRIAGE_BENEFITS;
  const { data, error } = await c
    .from("settings")
    .select("value")
    .eq("key", MARRIAGE_BENEFITS_KEY)
    .maybeSingle();
  if (error || !data?.value) return DEFAULT_MARRIAGE_BENEFITS;
  try {
    const p = JSON.parse(String(data.value));
    return {
      carSavingYearly: positive(p?.carSavingYearly),
      lifeCoverLow: positive(p?.lifeCoverLow),
      lifeCoverHigh: positive(p?.lifeCoverHigh),
      healthPremiumMonthly: positive(p?.healthPremiumMonthly),
      // A saved 0 is a real answer here ("they pay nothing"), so it's kept.
      healthEmployerPct: positive(p?.healthEmployerPct),
    };
  } catch {
    return DEFAULT_MARRIAGE_BENEFITS;
  }
}

// ── The joint tax saving, read rather than typed ─────────────────────────────
// Money App already works out both numbers for every year it has a baseline
// for: the tax filed together, and the tax the same year would have cost as two
// single returns. The gap between them is what the marriage saved that year.

export type JointTaxYear = { year: number; saved: number };

export type JointTaxSavings = {
  /** Newest year first. Only years where Money App has both numbers. */
  years: JointTaxYear[];
  /** The most recent year with a figure — the page's headline. */
  latest: JointTaxYear | null;
  /** Every year added up. */
  total: number;
  /** The average year, which is the fairest "per year" figure to lean on. */
  perYear: number | null;
  /** Why there's nothing to show, when there isn't. */
  error: string | null;
};

export const NO_JOINT_TAX_SAVINGS: JointTaxSavings = {
  years: [],
  latest: null,
  total: 0,
  perYear: null,
  error: null,
};

export async function getJointTaxSavings(): Promise<JointTaxSavings> {
  const { results, error } = await getTaxFilingResults();

  const years: JointTaxYear[] = results
    .filter((r) => r.mfjTax != null && r.singleTax != null)
    .map((r) => ({ year: r.year, saved: (r.singleTax ?? 0) - (r.mfjTax ?? 0) }))
    // A year where filing apart would have been cheaper isn't a saving, and
    // showing it as one would be dishonest — but it still belongs in the run of
    // years, so it's kept with its real (negative) figure.
    .sort((a, b) => b.year - a.year);

  if (years.length === 0) {
    return {
      ...NO_JOINT_TAX_SAVINGS,
      error:
        error ??
        "The Money App doesn't have both numbers for any year yet — the tax filed together, and what two single returns would have cost.",
    };
  }

  const total = years.reduce((sum, y) => sum + y.saved, 0);
  return {
    years,
    latest: years[0],
    total,
    perYear: Math.round(total / years.length),
    error: null,
  };
}

// ── What it adds up to ───────────────────────────────────────────────────────
// The three benefits that repeat every year. Life cover is deliberately left
// out: it's a one-time payout, not money saved each year, and folding it in
// would make the yearly figure look several hundred thousand dollars bigger
// than it is.

export type YearlyValue = {
  /** The three yearly benefits, only counting the ones we actually know. */
  total: number;
  tax: number | null;
  car: number | null;
  health: number | null;
  /** How many of the three are still blank — the page says so rather than
   *  presenting a part-filled total as the whole answer. */
  missing: number;
};

export function yearlyValue(
  benefits: MarriageBenefits,
  jointTax: JointTaxSavings
): YearlyValue {
  const tax = jointTax.perYear;
  const car = benefits.carSavingYearly;
  const health = healthYearly(benefits);

  const parts = [tax, car, health];
  return {
    total: parts.reduce((sum: number, p) => sum + (p ?? 0), 0),
    tax,
    car,
    health,
    missing: parts.filter((p) => p == null).length,
  };
}

/** What Comerica's share of Jamie's health cover is worth over a year. */
export function healthYearly(benefits: MarriageBenefits): number | null {
  const { healthPremiumMonthly, healthEmployerPct } = benefits;
  if (healthPremiumMonthly == null || healthEmployerPct == null) return null;
  return Math.round(healthPremiumMonthly * 12 * (healthEmployerPct / 100));
}
