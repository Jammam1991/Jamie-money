// ── Home Buying: what a lender would hand Jamie ───────────────────────────────
// Every number on this page is a knob. Nothing here reaches out to a bank or a
// listings feed — it's the same arithmetic a loan officer does on a notepad,
// run forwards and backwards so Jamie can see the size of house that falls out
// of his own massage income.
//
// Pure math and lookup tables only, no database — the client component imports
// this file directly so the figures move as fast as he types.

import { monthlyPayment } from "./payoff";

// ── The knobs ────────────────────────────────────────────────────────────────

export type HomeBuyingInputs = {
  /** What Jamie thinks he can bring in from massage over the next 12 months. */
  yearlyMassage: number;
  /** The slice the taxman takes off that, as a percent. */
  taxPct: number;
  /** A ZIP code, or "City, ST" — only used to guess the property tax rate. */
  place: string;
  /** Deposit, as a percent of the price of the house. */
  downPct: number;
  /** The mortgage interest rate. */
  ratePct: number;
  /** How many years the mortgage runs for. */
  years: number;
  /** Credit card minimums that already show on his credit report, per month. */
  cardPayments: number;
  /** The car payment on his credit report, per month. */
  carPayment: number;
  /** Anything else with a monthly payment — student loans, personal loans. */
  otherPayments: number;
  /** The most of his income a lender will let go out the door, as a percent. */
  dtiPct: number;
  /**
   * Yearly property tax as a percent of what the house is worth. Null means
   * "work it out from the place" — typing a number pins it instead.
   */
  propertyTaxPct: number | null;
  /** Yearly home insurance, as a percent of what the house is worth. */
  insurancePct: number;
  /** Yearly mortgage insurance, as a percent of the loan. Only under 20% down. */
  pmiPct: number;
  /** Association dues, per month. */
  hoaMonthly: number;
};

// The 30-year average was 6.67% on the Freddie Mac survey of 13 August 2026.
export const DEFAULT_RATE_PCT = 6.67;

export const DEFAULT_HOME_BUYING: HomeBuyingInputs = {
  yearlyMassage: 60000,
  taxPct: 20,
  place: "",
  downPct: 4,
  ratePct: DEFAULT_RATE_PCT,
  years: 30,
  cardPayments: 1000,
  carPayment: 2093,
  otherPayments: 0,
  dtiPct: 50,
  propertyTaxPct: null,
  insurancePct: 0.5,
  pmiPct: 0.55,
  hoaMonthly: 0,
};

// Under this much down, the lender adds mortgage insurance to the payment.
export const PMI_THRESHOLD_PCT = 20;

// ── Where the house is ───────────────────────────────────────────────────────
// Property tax is the one big cost that swings on geography — the same payment
// buys a much smaller house in New Jersey than in Alabama. These are the rough
// statewide averages of tax paid against what homes are worth. A real bill is
// set by the county, the school district and the town, so treat any of these as
// a starting guess and type the real rate once he's looking at an actual house.

export const NATIONAL_PROPERTY_TAX_PCT = 1.0;

export const STATE_PROPERTY_TAX_PCT: Record<string, number> = {
  AL: 0.4, AK: 1.07, AZ: 0.62, AR: 0.62, CA: 0.75, CO: 0.51, CT: 1.79,
  DE: 0.58, DC: 0.57, FL: 0.86, GA: 0.9, HI: 0.29, ID: 0.63, IL: 2.08,
  IN: 0.84, IA: 1.52, KS: 1.34, KY: 0.85, LA: 0.56, ME: 1.24, MD: 1.05,
  MA: 1.14, MI: 1.38, MN: 1.11, MS: 0.79, MO: 0.98, MT: 0.74, NE: 1.63,
  NV: 0.55, NH: 1.93, NJ: 2.23, NM: 0.78, NY: 1.64, NC: 0.8, ND: 0.98,
  OH: 1.53, OK: 0.9, OR: 0.93, PA: 1.49, RI: 1.4, SC: 0.57, SD: 1.17,
  TN: 0.67, TX: 1.68, UT: 0.57, VT: 1.83, VA: 0.87, WA: 0.94, WV: 0.57,
  WI: 1.61, WY: 0.61,
};

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington DC",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// The first three digits of a ZIP code say which state it's in. These are the
// mail-sorting ranges — a handful of states share a block, but for guessing a
// tax rate the edges don't matter.
const ZIP_RANGES: [number, number, string][] = [
  [5, 5, "NY"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"],
  [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"],
  [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"],
  [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
  [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"],
  [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"],
  [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"],
  [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"],
  [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"],
  [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
  [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"],
  [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"],
  [995, 999, "AK"],
];

function stateFromZip(zip: string): string | null {
  const prefix = Number(zip.slice(0, 3));
  if (!Number.isFinite(prefix)) return null;
  const hit = ZIP_RANGES.find(([lo, hi]) => prefix >= lo && prefix <= hi);
  return hit ? hit[2] : null;
}

/** Pull a state out of whatever Jamie typed: a ZIP, "Livonia, MI", "Michigan". */
export function stateFromPlace(place: string): string | null {
  const text = (place ?? "").trim().toUpperCase();
  if (!text) return null;

  const zip = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) {
    const found = stateFromZip(zip[1]);
    if (found) return found;
  }

  // Read two-letter codes back to front, so the state at the end of
  // "Livonia, MI" wins over a word like "IN" earlier in the line.
  const codes = text.match(/\b[A-Z]{2}\b/g);
  if (codes) {
    for (let i = codes.length - 1; i >= 0; i--) {
      if (STATE_PROPERTY_TAX_PCT[codes[i]] !== undefined) return codes[i];
    }
  }

  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (text.includes(name.toUpperCase())) return code;
  }
  return null;
}

// ── Working the loan backwards ───────────────────────────────────────────────

export type LoanSize = {
  /** The most he could borrow. */
  loan: number;
  /** The price of the house that loan buys, once the deposit is added on. */
  homeValue: number;
  /** The cash he'd need up front. */
  downPayment: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPmi: number;
  monthlyHoa: number;
  /** Everything above, added up — the whole house payment. */
  monthlyTotal: number;
  /** The most the lender lets go out the door each month, all debts included. */
  ceiling: number;
  /** What's already spoken for by the cards, the car and anything else. */
  existingDebt: number;
  /** What's left for a house after those. Zero if the debts already eat it all. */
  housingBudget: number;
  /** How far over the ceiling the existing debts already are, if they are. */
  shortfall: number;
  usingPmi: boolean;
};

const ZERO_LOAN: Omit<LoanSize, "ceiling" | "existingDebt" | "housingBudget" | "shortfall" | "usingPmi"> = {
  loan: 0,
  homeValue: 0,
  downPayment: 0,
  monthlyPI: 0,
  monthlyTax: 0,
  monthlyInsurance: 0,
  monthlyPmi: 0,
  monthlyHoa: 0,
  monthlyTotal: 0,
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * The biggest loan a monthly income supports.
 *
 * The lender caps everything Jamie owes each month at a share of what he earns.
 * Take the card and car payments off that cap and whatever's left is the whole
 * house payment — loan, property tax, insurance, mortgage insurance and dues.
 * Every one of those grows with the size of the house, so the loan is the one
 * unknown and the budget divides straight into it.
 */
export function sizeLoan(
  monthlyIncome: number,
  taxRatePct: number,
  input: HomeBuyingInputs,
): LoanSize {
  const ceiling = Math.max(0, monthlyIncome) * (clamp(input.dtiPct, 0, 100) / 100);
  const existingDebt =
    Math.max(0, input.cardPayments) +
    Math.max(0, input.carPayment) +
    Math.max(0, input.otherPayments);
  const hoa = Math.max(0, input.hoaMonthly);
  const budget = ceiling - existingDebt;
  const down = clamp(input.downPct, 0, 95) / 100;
  const usingPmi = input.downPct < PMI_THRESHOLD_PCT;

  const base = {
    ceiling,
    existingDebt,
    housingBudget: Math.max(0, budget),
    shortfall: budget < 0 ? -budget : 0,
    usingPmi,
  };
  if (budget - hoa <= 0) return { ...ZERO_LOAN, ...base, monthlyHoa: hoa };

  // What one dollar of loan costs per month, all-in. Property tax and insurance
  // are charged on the price of the house, not the loan, so they're scaled up
  // by the deposit before being folded in.
  const payFactor = monthlyPayment(1, input.ratePct, Math.max(1, Math.round(input.years)) * 12);
  const priceFactor = 1 / (1 - down);
  const perDollar =
    payFactor +
    ((clamp(taxRatePct, 0, 20) / 100) * priceFactor) / 12 +
    ((clamp(input.insurancePct, 0, 20) / 100) * priceFactor) / 12 +
    (usingPmi ? clamp(input.pmiPct, 0, 10) / 100 / 12 : 0);

  const loan = (budget - hoa) / perDollar;
  const homeValue = loan * priceFactor;

  const monthlyPI = loan * payFactor;
  const monthlyTax = (homeValue * (clamp(taxRatePct, 0, 20) / 100)) / 12;
  const monthlyInsurance = (homeValue * (clamp(input.insurancePct, 0, 20) / 100)) / 12;
  const monthlyPmi = usingPmi ? (loan * (clamp(input.pmiPct, 0, 10) / 100)) / 12 : 0;

  return {
    ...base,
    loan,
    homeValue,
    downPayment: homeValue - loan,
    monthlyPI,
    monthlyTax,
    monthlyInsurance,
    monthlyPmi,
    monthlyHoa: hoa,
    monthlyTotal: monthlyPI + monthlyTax + monthlyInsurance + monthlyPmi + hoa,
  };
}

export type HomeBuyingResult = {
  grossYear: number;
  taxTaken: number;
  netYear: number;
  netMonth: number;
  grossMonth: number;
  /** The state the place resolved to, or null if it didn't. */
  stateCode: string | null;
  /** The property tax rate actually used, and whether Jamie pinned it himself. */
  taxRatePct: number;
  taxRatePinned: boolean;
  /** The answer, run on take-home pay. This is the headline. */
  afterTax: LoanSize;
  /** The same sum run on the pre-tax figure, which is what a lender really uses. */
  beforeTax: LoanSize;
  /**
   * The massage income at which a lender would start allowing anything at all —
   * the point where the cap finally clears the car and the cards. Null when the
   * knobs make it unreachable (a 0% cap, or all income going to tax).
   */
  breakEvenGrossYear: number | null;
};

// Read the DTI sum backwards: what income does it take before the cap clears
// what's already owed? Below this figure the answer is zero no matter what the
// house costs, which is worth saying out loud rather than showing a blank.
function breakEvenIncome(input: HomeBuyingInputs): number | null {
  const dti = clamp(input.dtiPct, 0, 100) / 100;
  const keep = 1 - clamp(input.taxPct, 0, 100) / 100;
  if (dti <= 0 || keep <= 0) return null;
  const owed =
    Math.max(0, input.cardPayments) +
    Math.max(0, input.carPayment) +
    Math.max(0, input.otherPayments) +
    Math.max(0, input.hoaMonthly);
  return ((owed * 12) / dti) / keep;
}

export function homeBuyingMath(input: HomeBuyingInputs): HomeBuyingResult {
  const grossYear = Math.max(0, input.yearlyMassage);
  const taxTaken = grossYear * (clamp(input.taxPct, 0, 100) / 100);
  const netYear = grossYear - taxTaken;

  const stateCode = stateFromPlace(input.place);
  const taxRatePinned =
    input.propertyTaxPct !== null && Number.isFinite(input.propertyTaxPct);
  const taxRatePct = taxRatePinned
    ? (input.propertyTaxPct as number)
    : stateCode
      ? STATE_PROPERTY_TAX_PCT[stateCode]
      : NATIONAL_PROPERTY_TAX_PCT;

  return {
    grossYear,
    taxTaken,
    netYear,
    netMonth: netYear / 12,
    grossMonth: grossYear / 12,
    stateCode,
    taxRatePct,
    taxRatePinned,
    afterTax: sizeLoan(netYear / 12, taxRatePct, input),
    beforeTax: sizeLoan(grossYear / 12, taxRatePct, input),
    breakEvenGrossYear: breakEvenIncome(input),
  };
}

// ── Homes on the market ──────────────────────────────────────────────────────
// No listings feed here on purpose: Zillow and the rest don't hand out their
// for-sale data, and a scraped copy would go stale the day it was written. So
// instead of a fake shelf of houses, these are the real sites with the search
// already filled in — the place and the ceiling this page just worked out.

export type ListingLink = { site: string; url: string; note: string };

export function listingLinks(place: string, maxPrice: number): ListingLink[] {
  const trimmed = (place ?? "").trim();
  if (!trimmed || maxPrice <= 0) return [];
  const max = Math.round(maxPrice);
  const zip = trimmed.match(/\b\d{5}\b/)?.[0] ?? null;

  const dashed = encodeURIComponent(
    (zip ?? trimmed).replace(/\s*,\s*/g, "-").replace(/\s+/g, "-"),
  );
  const underscored = encodeURIComponent(
    (zip ?? trimmed).replace(/\s*,\s*/g, "_").replace(/\s+/g, "-"),
  );

  const links: ListingLink[] = [
    {
      site: "Zillow",
      url: `https://www.zillow.com/homes/for_sale/${dashed}/0-${max}_price/`,
      note: "For sale, up to your ceiling.",
    },
    {
      site: "Realtor.com",
      url: `https://www.realtor.com/realestateandhomes-search/${underscored}/price-na-${max}`,
      note: "The agents' own listings.",
    },
  ];
  if (zip) {
    links.push({
      site: "Redfin",
      url: `https://www.redfin.com/zipcode/${zip}/filter/max-price=${max}`,
      note: "Same houses, different map.",
    });
  }
  return links;
}
