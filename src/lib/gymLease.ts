import { createHash } from "node:crypto";

// ── The gym's lease, and what's being shopped to replace it ────────────────
// The current lease terms are static contract facts — they're hardcoded here
// the same way gym-dashboard-v2's own /admin/lease page hardcodes them,
// straight from the executed lease PDF. Everything else (renewal candidates,
// other spaces being shopped, the economics comparing them) comes live from
// the gym dashboard's lease board, so this page can never show a number
// Chris hasn't already seen there.
//
// Required env vars (add in Vercel → jamie-money → Settings → Environment):
//   GYM_DASHBOARD_URL      the dashboard's base URL
//   GYM_DASHBOARD_API_KEY  its GYM_INBOUND_API_KEY value — the same shared
//                          key the other cross-app endpoints there use

function fingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

// ── Current lease — static contract terms ───────────────────────────────────
// Source: Montier Martial Arts/Corporate/Commercial Lease/Executed/KEN -
// Boxing Prescription (Assignment) - Lease (Mutually Executed).pdf

export type RentYear = { year: 1 | 2 | 3; label: string; monthly: number };

export type CurrentLease = {
  landlord: string;
  tenant: string;
  address: string;
  city: string;
  startDate: string;
  endDate: string;
  permittedUse: string;
  requiredHours: string;
  rentSchedule: RentYear[];
  camMonthly: number;
  camDescription: string;
  securityDeposit: number;
  paymentMethod: string;
  lateFee: string;
  bouncedAchFee: number;
  holdoverRent: string;
  requiredInsurance: string;
  defaultTriggers: string[];
};

export const CURRENT_LEASE: CurrentLease = {
  landlord: "Kenneth Village Properties, LLC",
  tenant: "Montier Martial Arts LLC",
  address: "Kenneth Village",
  city: "Glendale, CA",
  startDate: "Dec 1, 2024",
  endDate: "Jan 19, 2027",
  permittedUse: "First-class boxing transformation gym (and nothing else)",
  requiredHours: "10:00 a.m. – 6:00 p.m., 7 days a week (minimum)",
  rentSchedule: [
    { year: 1, label: "Year 1", monthly: 5202.44 },
    { year: 2, label: "Year 2", monthly: 5358.51 },
    { year: 3, label: "Year 3", monthly: 5519.27 },
  ],
  camMonthly: 2300,
  camDescription:
    "Tenant's pro-rata share of shopping center operating costs (CAM) — billed on top of base rent as a monthly estimate, reconciled after year-end against actual costs. The estimate is set by the landlord and changes; this is the current figure from the gym dashboard's lease board.",
  securityDeposit: 33212,
  paymentMethod: "ACH, due before the 1st of each month",
  lateFee:
    "If unpaid by the 3rd: 12% APR plus the larger of 10% of the bill or $100. Two late payments counts as default.",
  bouncedAchFee: 100,
  holdoverRent: "300% of last month's rent if occupying past Jan 19, 2027 without renewal",
  requiredInsurance: "$1M per occurrence / $3M aggregate liability, plus $5M umbrella",
  defaultTriggers: [
    "Missed rent (2 late payments)",
    "Abandoning the space",
    "Bankruptcy",
    "False financials",
    "Damage or waste",
    "Not actually operating the business",
  ],
};

// Lease-year boundaries, so "the rent right now" tracks the calendar instead
// of needing to be updated by hand every December.
const YEAR_STARTS = ["2024-12-01", "2025-12-01", "2026-12-01"] as const;

export function currentLeaseYear(now: Date = new Date()): 1 | 2 | 3 {
  const starts = YEAR_STARTS.map((d) => new Date(`${d}T00:00:00`));
  if (now >= starts[2]) return 3;
  if (now >= starts[1]) return 2;
  return 1;
}

export function daysUntilLeaseEnd(now: Date = new Date()): number {
  const end = new Date("2027-01-19T12:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

// ── Live lease board — pulled from gym-dashboard-v2 ─────────────────────────

export type LeaseDealType = "lease" | "sublease" | "purchase";
export type LeaseStatus = "new" | "shortlist" | "touring" | "negotiating" | "signed" | "passed";

export type LeaseEconomics = {
  monthlyNow: number | null;
  effectiveMonthly: number | null;
  effectivePsf: number | null;
  upfrontCash: number | null;
  totalTermCost: number | null;
  termMonths: number;
  termAssumed: boolean;
  equityMonthly: number | null;
  breakdown: string[];
};

export type LeaseFit = { met: number; known: number; pct: number | null };

export type LeaseOpportunity = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  deal_type: LeaseDealType;
  status: LeaseStatus;
  source: string;
  listing_url: string | null;
  is_current: boolean;
  broker_name: string | null;
  broker_company: string | null;
  broker_phone: string | null;
  broker_email: string | null;
  size_sqft: number | null;
  ceiling_height_ft: number | null;
  parking_spaces: number | null;
  restrooms: number | null;
  power_amps: number | null;
  drive_minutes: number | null;
  available_date: string | null;
  has_showers: boolean | null;
  has_hvac: boolean | null;
  has_sprinklers: boolean | null;
  ground_floor: boolean | null;
  street_frontage: boolean | null;
  has_loading: boolean | null;
  zoning_ok: boolean | null;
  base_rent_monthly: number | null;
  cam_monthly: number | null;
  lease_term_months: number | null;
  annual_increase_pct: number | null;
  free_rent_months: number | null;
  ti_allowance_psf: number | null;
  security_deposit: number | null;
  purchase_price: number | null;
  down_payment_pct: number | null;
  interest_rate_pct: number | null;
  amortization_years: number | null;
  property_tax_annual: number | null;
  insurance_annual: number | null;
  hoa_monthly: number | null;
  buildout_cost: number | null;
  moving_cost: number | null;
  rating: number | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  toured_on: string | null;
  created_at: string;
  updated_at: string;
  economics: LeaseEconomics;
  fit: LeaseFit;
};

function gymUrl(): string | undefined {
  return process.env.GYM_DASHBOARD_URL;
}

function headerSafe(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || /[^\t\x20-\x7e]/.test(v)) return null;
  return v;
}

function originOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function gymLeaseReady(): boolean {
  return Boolean(gymUrl() && process.env.GYM_DASHBOARD_API_KEY);
}

export type LeaseOpportunitiesResult = {
  opportunities: LeaseOpportunity[];
  problem: string | null;
};

const GYM_CACHE_SECONDS = 300; // 5 minutes
const GYM_TIMEOUT_MS = 8000;

export async function getLeaseOpportunities(): Promise<LeaseOpportunitiesResult> {
  const baseUrl = gymUrl();
  const apiKey = headerSafe(process.env.GYM_DASHBOARD_API_KEY);
  if (!baseUrl || !apiKey) {
    const missing = [
      !baseUrl && "GYM_DASHBOARD_URL",
      !apiKey && "GYM_DASHBOARD_API_KEY",
    ].filter(Boolean);
    return {
      opportunities: [],
      problem: `Not connected to the gym dashboard — ${missing.join(" and ")} ${
        missing.length > 1 ? "are" : "is"
      } missing in Vercel. (Adding it needs a redeploy to take effect.)`,
    };
  }

  const origin = originOf(baseUrl);
  if (!origin) {
    return {
      opportunities: [],
      problem: `GYM_DASHBOARD_URL doesn't look like a web address: "${baseUrl}". It should be like https://gym-dashboard-v2.vercel.app`,
    };
  }
  const url = `${origin}/api/lease/opportunities`;
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: GYM_CACHE_SECONDS },
      signal: AbortSignal.timeout(GYM_TIMEOUT_MS),
    });
    if (res.status === 503) {
      const body = await res.json().catch(() => null);
      return {
        opportunities: [],
        problem:
          body?.detail ??
          "The gym dashboard has no GYM_INBOUND_API_KEY set, so it rejects every key. Set one there and use the same value here.",
      };
    }
    if (res.status === 401) {
      const body = await res.json().catch(() => null);
      const mine = `${apiKey.length} chars, ${fingerprint(apiKey)}`;
      const theirs =
        body?.expectedFingerprint && body?.expectedLength
          ? `${body.expectedLength} chars, ${body.expectedFingerprint}`
          : null;

      if (!theirs) {
        return {
          opportunities: [],
          problem: `The gym dashboard rejected this key (${mine}). Its own deploy may predate the version that reports which key it expects — redeploy the gym dashboard and look again.`,
        };
      }
      return {
        opportunities: [],
        problem:
          theirs === mine
            ? `Both ends hold the same key (${mine}) and it's still being rejected — so the gym dashboard is serving an older build. Redeploy it and make sure the new deployment becomes the live one.`
            : `The keys don't match. This app sends ${mine}; the gym dashboard expects ${theirs}. Paste the same value into both, then redeploy both.`,
      };
    }
    if (res.status === 404) {
      return {
        opportunities: [],
        problem: `Nothing at ${url} — either that isn't the gym dashboard's address, or its latest deploy hasn't gone out yet.`,
      };
    }
    if (!res.ok) {
      return { opportunities: [], problem: `The gym dashboard returned ${res.status}.` };
    }

    const body = await res.json();
    if (!Array.isArray(body?.opportunities)) {
      return { opportunities: [], problem: "The gym dashboard sent something unexpected." };
    }

    return { opportunities: body.opportunities as LeaseOpportunity[], problem: null };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      opportunities: [],
      problem: timedOut
        ? `The gym dashboard didn't answer within ${
            GYM_TIMEOUT_MS / 1000
          } seconds, so the live options didn't load. Open the page again in a moment.`
        : `Couldn't reach the gym dashboard — ${
            err instanceof Error ? err.message : "no answer"
          }.`,
    };
  }
}
