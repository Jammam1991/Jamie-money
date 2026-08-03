// ── The debt story, in numbers ────────────────────────────────────────────────
// Every figure the "Debt Story" screen shows lives here, so the page itself is
// pure storytelling and the math can be checked in one place. The marriage-years
// figures are Chris's own estimates; everything from the gym is off the BoxingRX
// books. Edit a number here and the whole page re-adds itself.

export const STORY = {
  marriedYear: 2020,
  separatedYear: 2023,

  // Years 2020-2023: the pile the two of them built together.
  jointDebt: 212_000,

  // Chris's paycheck in those years: cash in, his own bills out.
  chrisCashMonthly: 5_500,
  chrisBillsMonthly: 3_000,
  yearsTogether: 3,

  // Retirement Chris built since 2020 — a marital asset, so a slice of it is
  // arguably Jamie's. It's the one line that goes Jamie's way. Chris's number,
  // not a straight half.
  chris401k: 50_000,
  jamieRetirementShare: 15_000,

  // What Jamie brought in: two years of unemployment/boxing money, then a year
  // of massage income.
  jamieWeeklyEarly: 1_300,
  jamieEarlyYears: 2,
  jamieMonthlyLate: 13_000,
  jamieLateMonths: 12,

  // What Jamie put toward the debt payments in all that time.
  jamiePaidOnDebt: 0,

  // The car loan. Both names are on the paper, but it's Jamie's car, Jamie
  // drives it, and the gym has been making the payments — so the whole balance
  // sits on his side. Counted separately from the 2020-2023 pile above.
  carLoan: 86_000,

  // Dec 2024 was the first full month they owned BoxingRX.
  gymStartYear: 2024,
  gymStartMonth: 12,

  // Jamie ran the place, and a manager doing that job would have been paid. He
  // never was on paper — he took money out instead. So the pay he earned is set
  // against what he drew, and only the excess is a debt.
  //
  // Held at 2,000 on purpose. Jamie was also collecting PT cash off the books
  // the whole time, and none of it was tracked. Once that's counted it comes
  // out of what the gym still owes him, so crediting a full manager's wage on
  // top would pay him twice. Raise this once the PT number is known.
  managerMonthly: 2_000,

  // Equity actually contributed, from the books.
  contributionsChris: 1_243.93,
  contributionsJamie: 1_000.0,
} as const;

// ── What the gym owes Chris ──────────────────────────────────────────────────
// The "Due to Chris / Chris Advances" account. This is the real cost of keeping
// the doors open — loans and card payments Chris made personally, not the rough
// "about 65k" figure he carried in his head.
export const ADVANCES = [
  {
    label: "Personal loan to the business (transfers)",
    amount: 79_750.23,
    kind: "long-term liability",
  },
  {
    label: "Personal loan to the business (charges)",
    amount: 37_395.01,
    kind: "liability",
  },
  { label: "Credit card payments", amount: 30_142.45, kind: "" },
  { label: "Advance for Jamie's distribution", amount: -6.55, kind: "" },
] as const;

export const gymOwesChris = ADVANCES.reduce((sum, a) => sum + a.amount, 0);

// ── Things, not money ────────────────────────────────────────────────────────
// Personal property bought during the marriage. Jamie is holding all of it, so
// Chris's half is a real line on the bill — if Jamie keeps the things, he owes
// Chris what half of them are worth.
export const ASSETS = [
  { item: "Rolex", value: 30_000, who: "Jamie holds" },
  { item: "Rolex", value: 15_000, who: "Jamie holds" },
  { item: "Jewellery and other items", value: 20_000, who: "Jamie holds" },
] as const;

export const assetsTotal = ASSETS.reduce((sum, a) => sum + a.value, 0);
export const assetsHalf = assetsTotal / 2;

// ── What each of them took out ───────────────────────────────────────────────
// Jamie's draws, line by line, from the BoxingRX books. Cents kept on purpose —
// these come off real statements, not from memory. Does NOT include the
// untracked PT cash, which nobody can total.
export const DRAWS = [
  { bucket: "Taycan", amount: 31_630.86, what: "His car loan payments" },
  { bucket: "Transfers", amount: 9_075.0, what: "Cash straight to him" },
  { bucket: "Charges", amount: 7_434.77, what: "Card spending" },
  { bucket: "Car Insurance", amount: 6_458.3, what: "Tesla insurance" },
  {
    bucket: "Equinox",
    amount: 3_940.0,
    what: "Gym membership + transfers to his account",
  },
] as const;

export const drawsTotal = DRAWS.reduce((sum, d) => sum + d.amount, 0);
export const chrisDrawsTotal = 16_925.87;

// ── Derived ──────────────────────────────────────────────────────────────────

const monthsTogether = STORY.yearsTogether * 12;

// What was left of Chris's paycheck each month once his own bills were paid —
// money that should have piled up, and instead went out the door.
export const chrisSpareMonthly = STORY.chrisCashMonthly - STORY.chrisBillsMonthly;
export const chrisSpareTotal = chrisSpareMonthly * monthsTogether;

// Jamie's earnings over the same stretch.
export const jamieEarlyTotal =
  STORY.jamieWeeklyEarly * 52 * STORY.jamieEarlyYears;
export const jamieLateTotal = STORY.jamieMonthlyLate * STORY.jamieLateMonths;
export const jamieEarnedTotal = jamieEarlyTotal + jamieLateTotal;

// Full months Jamie has been running the gym, counted from the first full month
// of ownership up to the last completed month. Takes "now" as an argument so the
// page renders on the server and never disagrees with itself after hydration.
export function monthsAsManager(now: Date): number {
  const months =
    (now.getFullYear() - STORY.gymStartYear) * 12 +
    (now.getMonth() + 1 - STORY.gymStartMonth);
  return Math.max(0, months);
}

// The gym side of the settle-up. The manager pay Jamie earned is set against
// what he actually drew; only the excess is money he has to hand back.
export function gymSettleUp(now: Date) {
  const months = monthsAsManager(now);
  const earned = months * STORY.managerMonthly;
  const overdraw = Math.max(0, drawsTotal - earned);
  const underdraw = Math.max(0, earned - drawsTotal);
  return { months, earned, overdraw, underdraw };
}

// The bill. Half of what they borrowed together, half of what the gym owes
// Chris if it closes its doors, plus anything Jamie drew beyond the pay he
// earned — less his slice of the retirement.
export const jamieHalfOfDebt = Math.round(STORY.jointDebt / 2);
export const jamieHalfOfGymDebt = gymOwesChris / 2;
export const jamieRetirementClaim = STORY.jamieRetirementShare;

export function bill(now: Date) {
  const { overdraw } = gymSettleUp(now);
  const owes =
    jamieHalfOfDebt +
    STORY.carLoan +
    jamieHalfOfGymDebt +
    overdraw +
    assetsHalf;
  return { overdraw, owes, net: owes - jamieRetirementClaim };
}
