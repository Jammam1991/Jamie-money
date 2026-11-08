// ── Home Buying: Jamie's situation, and Claude's read on it ─────────────────
// The calculator below this on the page is a lender's notepad. Real life is
// messier — the divorce, cash income, a car that's nearly paid off — so Jamie
// (or Admin) writes the situation down once here, and Claude reads it together
// with the numbers the app already has and says what price and payment make
// sense. One JSON row in `settings` (key "home_plan"), no table to create.
// Shared by the server and the browser: the shapes and the cleaner.

export type HomeProfile = {
  /** Cash saved toward a down payment and closing costs. */
  savedForDown: number | null;
  creditScore: number | null;
  /** What actually lands in his account in a normal month, all sources. */
  monthlyTakeHome: number | null;
  /** Divorce support or settlement payments, per month. */
  divorceMonthly: number | null;
  /** The most he'd be comfortable paying for housing each month. */
  comfortMonthly: number | null;
  /** "This year", "1–2 years"… in his words. */
  timeline: string;
  /** Anything else: how steady the income is, what's changing, must-haves. */
  notes: string;
};

export type HomeAnalysis = {
  verdict: "ready" | "almost" | "not_yet";
  headline: string;
  comfortableMonthly: number;
  maxMonthly: number;
  comfortablePrice: number;
  maxPrice: number;
  downPaymentPct: number;
  summary: string;
  nextSteps: string[];
  watchOuts: string[];
};

export type HomePlan = {
  profile: HomeProfile;
  analysis: HomeAnalysis | null;
  analyzedAt: string | null;
};

export const EMPTY_PROFILE: HomeProfile = {
  savedForDown: null,
  creditScore: null,
  monthlyTakeHome: null,
  divorceMonthly: null,
  comfortMonthly: null,
  timeline: "",
  notes: "",
};

export const MAX_NOTES = 4000;

function money(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function cleanProfile(raw: unknown): HomeProfile {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const score = money(p.creditScore);
  return {
    savedForDown: money(p.savedForDown),
    creditScore: score !== null && score >= 300 && score <= 850 ? Math.round(score) : null,
    monthlyTakeHome: money(p.monthlyTakeHome),
    divorceMonthly: money(p.divorceMonthly),
    comfortMonthly: money(p.comfortMonthly),
    timeline: typeof p.timeline === "string" ? p.timeline.slice(0, 100) : "",
    notes: typeof p.notes === "string" ? p.notes.slice(0, MAX_NOTES) : "",
  };
}

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, 8) : [];

export function cleanAnalysis(raw: unknown): HomeAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const verdict = a.verdict === "ready" || a.verdict === "almost" || a.verdict === "not_yet" ? a.verdict : null;
  const n = (v: unknown) => money(v) ?? 0;
  if (!verdict || typeof a.headline !== "string") return null;
  return {
    verdict,
    headline: a.headline,
    comfortableMonthly: n(a.comfortableMonthly),
    maxMonthly: n(a.maxMonthly),
    comfortablePrice: n(a.comfortablePrice),
    maxPrice: n(a.maxPrice),
    downPaymentPct: Math.min(100, n(a.downPaymentPct)),
    summary: typeof a.summary === "string" ? a.summary : "",
    nextSteps: strings(a.nextSteps),
    watchOuts: strings(a.watchOuts),
  };
}

export function parseHomePlan(raw: unknown): HomePlan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    profile: cleanProfile(r.profile),
    analysis: cleanAnalysis(r.analysis),
    analyzedAt: typeof r.analyzedAt === "string" ? r.analyzedAt : null,
  };
}

/** How a house's all-in monthly payment sits against Claude's numbers. */
export type Fit = "fits" | "stretch" | "over";

export function fitFor(monthly: number, comfortable: number, max: number): Fit {
  if (monthly <= comfortable) return "fits";
  if (monthly <= max) return "stretch";
  return "over";
}
