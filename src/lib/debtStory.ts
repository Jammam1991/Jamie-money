// ── The debt story, in numbers ────────────────────────────────────────────────
// Every figure the "Debt Story" screen shows lives here, so the page itself is
// pure storytelling and the math can be checked in one place. These are Chris's
// own figures — estimates, not statements — edit them here and the whole page
// (including the bottom line) re-adds itself.

export const STORY = {
  marriedYear: 2020,
  separatedYear: 2023,

  // Years 2020-2023: the pile the two of them built together.
  jointDebt: 212_000,

  // Chris's paycheck in those years: cash in, his own bills out.
  chrisCashMonthly: 5_500,
  chrisBillsMonthly: 3_000,
  yearsTogether: 3,

  // Retirement Chris built since 2020 — a marital asset, so half of it is
  // arguably Jamie's. It's the one line that goes Jamie's way.
  chris401k: 50_000,

  // What Jamie brought in: two years of unemployment/boxing money, then a year
  // of massage income.
  jamieWeeklyEarly: 1_300,
  jamieEarlyYears: 2,
  jamieMonthlyLate: 13_000,
  jamieLateMonths: 12,

  // What Jamie put toward the debt payments in all that time.
  jamiePaidOnDebt: 0,

  // The gym, started after they separated.
  businessInvestment: 65_000,
  jamieBusinessInvestment: 0,
} as const;

// What Jamie actually pulled out of the gym for himself, line by line, from the
// BoxingRX books. Cents kept on purpose — these come off real statements, not
// from memory. Does NOT include the untracked PT cash, which nobody can total.
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

// The bill: half of what they borrowed together, plus half of what Chris alone
// put into the business they started together, plus every dollar Jamie took out
// of that business for himself. The three don't overlap — the shared debt was
// built before the gym existed, the investment is money Chris put in, and the
// draws are money Jamie took out.
export const jamieHalfOfDebt = Math.round(STORY.jointDebt / 2);
export const jamieHalfOfBusiness = Math.round(
  (STORY.businessInvestment - STORY.jamieBusinessInvestment) / 2
);
export const jamieOwes = jamieHalfOfDebt + jamieHalfOfBusiness + drawsTotal;

// The offset that runs the other direction: half the retirement Chris built
// while they were married.
export const jamieRetirementClaim = Math.round(STORY.chris401k / 2);
export const jamieOwesNet = jamieOwes - jamieRetirementClaim;
