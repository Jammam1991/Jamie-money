// The 401k Payback Plan — the math, and nothing else.
//
// The idea Chris wants Jamie to see: Chris moves a share of his 401(k) into
// Jamie's own retirement account as part of the split, and Jamie pays back what
// he owes Chris a month at a time. If that 401(k) money keeps growing the way
// Chris's has, by 60 it is worth about as much as every payment Jamie made —
// so each payment reads less like money gone and more like money that comes
// back to him later.
//
// Pure functions only. A COPY of Money App's lib/retirement-plan.ts — Money App
// sends the starting numbers (/api/divorce/retirement-plan) and both apps run
// this same math, so Chris's screen and this one agree. Change one, change the
// other.

export type ContribMode = "dollars" | "percent";

/** Everything the plan needs. Dollar amounts are positive. */
export type PlanInputs = {
  /** What Jamie owes Chris, to be paid back monthly. */
  jamieOwes: number;
  /** The 401(k) share Chris moves into Jamie's own account. */
  fromChris: number;
  /** What Jamie pays Chris each month. */
  monthlyPayment: number;
  /** Interest Chris charges on the loan, % a year. 0 = none. */
  loanRatePct: number;
  /** Yearly growth guess for the 401(k), %. */
  returnPct: number;
  /** Jamie's birthday, YYYY-MM-DD. */
  birthDate: string;
  /** The age the plan runs to. */
  retireAge: number;
  /** Jamie's own savings on top: a flat $ a month, or a % of his pay. */
  contribMode: ContribMode;
  contribMonthly: number;
  contribPct: number;
  /** Jamie's yearly pay, used only in percent mode. */
  yearlyPay: number;
  /** How much the savings (or pay) goes up each year, %. */
  raisePct: number;
};

export type YearPoint = {
  age: number;
  /** Total Jamie has paid Chris so far. */
  loanPaid: number;
  /** What Jamie still owes Chris. */
  loanLeft: number;
  /** The 401(k) money from Chris, grown, with nothing added. */
  fromChris: number;
  /** The same 401(k) plus Jamie's own monthly savings. */
  withSavings: number;
  /** Jamie's own money put in so far (before growth). */
  contributed: number;
};

export type PlanResult = {
  /** Jamie's age today, to one decimal. */
  ageNow: number;
  /** Whole months from today to retireAge. */
  monthsToRetire: number;
  /** Months until the loan is paid off, or null if the payment never clears it. */
  payoffMonths: number | null;
  /** Age when the loan is paid off. */
  payoffAge: number | null;
  /** Every dollar Jamie pays Chris, interest included, until it's paid off. */
  totalLoanPaid: number;
  /** The 401(k) money from Chris at retireAge, with nothing added. */
  fromChrisAtRetire: number;
  /** The same 401(k) with Jamie's own savings added. */
  withSavingsAtRetire: number;
  /** Jamie's own money put in by retireAge (before growth). */
  contributedTotal: number;
  /** fromChrisAtRetire ÷ totalLoanPaid — 1 or more means it covers every payment. */
  coverage: number;
  /** A safe yearly draw from the account (4% a year), shown per month. */
  monthlyIncomeFromChris: number;
  monthlyIncomeWithSavings: number;
  /** First age the grown 401(k) from Chris is worth at least everything paid back. Null if never by retireAge. */
  evenAge: number | null;
  /** One row per year of age, today → retireAge, for the chart. */
  points: YearPoint[];
};

/** How much a year of withdrawals can safely take: the common 4% rule. */
export const SAFE_DRAW_RATE = 0.04;

/** Years between two YYYY-MM-DD dates, built from parts so time zones can't shift a day. */
export function yearsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const months = (ty - fy) * 12 + (tm - fm) + (td - fd) / 30.4375;
  return months / 12;
}

const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

/** Jamie's own deposit in a given month, counting from today. */
function contributionFor(i: PlanInputs, month: number): number {
  const year = Math.floor(month / 12);
  const grow = Math.pow(1 + i.raisePct / 100, year);
  if (i.contribMode === "percent") return (i.yearlyPay * grow * (i.contribPct / 100)) / 12;
  return i.contribMonthly * grow;
}

export function runPlan(i: PlanInputs, today: string): PlanResult {
  const ageNow = Math.max(0, yearsBetween(i.birthDate, today));
  const monthsToRetire = Math.max(0, Math.round((i.retireAge - ageNow) * 12));
  const growth = monthlyRate(i.returnPct);
  const loanRate = i.loanRatePct / 100 / 12;
  const payment = Math.max(0, i.monthlyPayment);

  let loanLeft = Math.max(0, i.jamieOwes);
  let loanPaid = 0;
  let payoffMonths: number | null = loanLeft === 0 ? 0 : null;
  let fromChris = Math.max(0, i.fromChris);
  let withSavings = fromChris;
  let contributed = 0;

  const point = (m: number): YearPoint => ({
    age: Math.round((ageNow + m / 12) * 10) / 10,
    loanPaid,
    loanLeft,
    fromChris,
    withSavings,
    contributed,
  });
  const points: YearPoint[] = [point(0)];

  // The loan can outlast retireAge, so it runs on its own clock for the total
  // paid. 100 years is "never" — a payment that doesn't cover the interest.
  const loanMonths = Math.max(monthsToRetire, 1200);
  for (let m = 1; m <= loanMonths; m++) {
    if (loanLeft > 0) {
      loanLeft += loanLeft * loanRate;
      const pay = Math.min(payment, loanLeft);
      loanLeft -= pay;
      loanPaid += pay;
      if (loanLeft < 0.005) {
        loanLeft = 0;
        payoffMonths ??= m;
      }
    }
    if (m <= monthsToRetire) {
      const c = contributionFor(i, m - 1);
      fromChris *= 1 + growth;
      withSavings = withSavings * (1 + growth) + c;
      contributed += c;
      if (m % 12 === 0 || m === monthsToRetire) points.push(point(m));
    } else if (loanLeft === 0) {
      break;
    }
  }

  // The headline compares against everything he'll pay, even past retireAge.
  const totalLoanPaid = loanPaid;
  // Yearly is close enough for "around what age"; the chart is yearly too.
  const evenAge =
    totalLoanPaid > 0 ? (points.find((p) => p.fromChris >= totalLoanPaid)?.age ?? null) : null;
  const fromChrisAtRetire = points[points.length - 1].fromChris;
  const withSavingsAtRetire = points[points.length - 1].withSavings;

  return {
    ageNow: Math.round(ageNow * 10) / 10,
    monthsToRetire,
    payoffMonths,
    payoffAge: payoffMonths === null ? null : Math.round((ageNow + payoffMonths / 12) * 10) / 10,
    totalLoanPaid,
    fromChrisAtRetire,
    withSavingsAtRetire,
    contributedTotal: contributed,
    coverage: totalLoanPaid > 0 ? fromChrisAtRetire / totalLoanPaid : 0,
    monthlyIncomeFromChris: (fromChrisAtRetire * SAFE_DRAW_RATE) / 12,
    monthlyIncomeWithSavings: (withSavingsAtRetire * SAFE_DRAW_RATE) / 12,
    evenAge,
    points,
  };
}

/** The monthly payment that clears `owed` in `years` at `ratePct` a year. */
export function paymentForYears(owed: number, years: number, ratePct: number): number {
  const n = Math.max(1, Math.round(years * 12));
  const r = ratePct / 100 / 12;
  if (r === 0) return owed / n;
  return (owed * r) / (1 - Math.pow(1 + r, -n));
}

// ── The knobs, before live numbers are filled in ─────────────────────────────

/** Which figure "what Jamie owes" starts from. */
export type OwesSource = "settle" | "claim" | "loans";

export const OWES_SOURCE_LABEL: Record<OwesSource, string> = {
  settle: "If you settle",
  claim: "The full claim",
  loans: "Loans on the books",
};

/** What the page lets you change. `null` on an override means "use the live number". */
export type PlanSettings = {
  /** Which figure Jamie owes starts from. */
  jamieOwesSource: OwesSource;
  /** Type a figure to use instead of the one jamieOwesSource picks. */
  jamieOwesOverride: number | null;
  /** % of Chris's whole 401(k) moved to Jamie. */
  splitPct: number;
  /** Type a $ figure to use instead of splitPct. */
  splitOverride: number | null;
  /** Type a monthly payment, or leave null to spread the debt over payoffYears. */
  monthlyPayment: number | null;
  payoffYears: number;
  loanRatePct: number;
  returnPct: number;
  birthDate: string;
  retireAge: number;
  contribMode: ContribMode;
  contribMonthly: number;
  contribPct: number;
  yearlyPay: number;
  raisePct: number;
};

/** The live figures the plan starts from. Null when it couldn't be read. */
export type PlanLive = {
  /** The settlement claim, every chapter (the hub's "Jamie owes"). Positive. */
  claimTotal: number;
  /** What the claim likely settles at (the "settle" scenario). Positive. */
  settleEstimate: number;
  /** Private loans still owed to Chris, all-time, net of repayments. */
  loanBalance: number | null;
  /** Chris's 401(k) as Fidelity reports it (excludes money out on loan). */
  k401Investments: number | null;
  /** Money Chris has borrowed from the 401(k) and is paying back into it. */
  k401LoanReceivable: number | null;
};

/** Everything the plan page and Jamie's app are handed. */
export type PlanBase = {
  asOf: string;
  live: PlanLive;
  settings: PlanSettings;
};

/** The whole 401(k): what's invested plus what's out on loan to Chris and coming back. */
export function k401Total(live: PlanLive): number {
  return (live.k401Investments ?? 0) + (live.k401LoanReceivable ?? 0);
}

/** The figure each OwesSource points at. */
export function owesFromSource(source: OwesSource, live: PlanLive): number {
  if (source === "claim") return live.claimTotal;
  if (source === "settle") return live.settleEstimate;
  return Math.max(0, live.loanBalance ?? 0);
}

/** Turn the knobs plus the live figures into the numbers runPlan needs. */
export function resolveInputs(s: PlanSettings, live: PlanLive): PlanInputs {
  const jamieOwes = s.jamieOwesOverride ?? owesFromSource(s.jamieOwesSource, live);
  const fromChris = s.splitOverride ?? (k401Total(live) * s.splitPct) / 100;
  const monthlyPayment = s.monthlyPayment ?? paymentForYears(jamieOwes, s.payoffYears, s.loanRatePct);
  return {
    jamieOwes,
    fromChris,
    monthlyPayment,
    loanRatePct: s.loanRatePct,
    returnPct: s.returnPct,
    birthDate: s.birthDate,
    retireAge: s.retireAge,
    contribMode: s.contribMode,
    contribMonthly: s.contribMonthly,
    contribPct: s.contribPct,
    yearlyPay: s.yearlyPay,
    raisePct: s.raisePct,
  };
}
