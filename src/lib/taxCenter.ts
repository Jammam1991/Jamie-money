import { client } from "./store";

// ── Tax Center ─────────────────────────────────────────────────────────────
// Year-by-year: what was actually paid in taxes, what came back as a refund,
// and what the refund went toward — read live from Money App's "Filed" tab on
// its Global Tax Center. Nothing is saved here, the same as businessFinances.ts
// — every load asks Money App fresh, so an edit over there shows up on the
// next page load with no sync to remember.
//
// The Google Drive links to the actual return documents are the one thing
// this app stores itself (in `tax_documents`), because Money App has no
// concept of them.
//
// Required env vars (Vercel → jamie-money → Settings → Environment):
//   MONEYAPP_API_URL / MONEYAPP_API_KEY — the same pair the debt sync uses.

/** One line in a breakdown — a label and a dollar amount, already in plain words. */
export type TaxLine = { label: string; amount: number; note?: string };

/** Where one slice of a refund went, and why. */
export type RefundAllocation = {
  amount: number;
  destination: string;
  description: string | null;
};

/** One typed refund for the year (Federal, State, …) and its splits. */
export type TaxRefund = {
  type: string;
  amount: number;
  allocations: RefundAllocation[];
};

/**
 * How the year was filed. Money App has no record of the status actually put
 * on the return, so this follows the "married on December 31" box from that
 * year's planning baseline — which is the same thing the IRS keys filing
 * status off. `certain` is always false today; the page words it as Money
 * App's reading rather than a fact from the return.
 */
export type FiledAs = {
  key: string;
  label: string;
  blurb: string;
  married: boolean;
  certain: boolean;
};

/**
 * The year rebuilt from Money App's saved baseline: what came in, what came
 * off, and what the tax worked out to. Every figure is an estimate — Jamie's
 * side of the baseline holds only her income, so the household totals lean on
 * Chris's return shape.
 */
export type TaxBreakdown = {
  estimated: boolean;
  income: {
    chris: TaxLine[];
    jamie: TaxLine[];
    chrisTotal: number;
    jamieTotal: number;
    total: number;
  };
  adjustments: { lines: TaxLine[]; total: number };
  agi: number;
  deduction: {
    used: number;
    usedItemized: boolean;
    lines: TaxLine[];
    extras: TaxLine[];
    qbi: number;
  };
  taxableIncome: number;
  tax: {
    lines: TaxLine[];
    credits: number;
    federal: number;
    state: number;
    total: number;
  };
  paidIn: number;
  /** Positive = still owed. Negative = refund. */
  balance: number;
  effectiveRate: number;
};

export type TaxFilingResult = {
  year: number;
  taxesPaid: number | null;
  refundAmount: number | null;
  refundUsedFor: string | null;
  /** Every refund for the year, split by type and by where each part went.
   *  Supersedes the flattened `refundAmount`/`refundUsedFor` pair above. */
  refunds: TaxRefund[];
  jamieIncome: number | null;
  chrisIncome: number | null;
  /** What the year would've cost filing jointly vs. as two single returns —
   *  present only when Money App has both a saved baseline for the year and
   *  jamieIncome on file. Jamie's side carries only her income (no
   *  deductions/withholding of her own), so this is a rough estimate. */
  mfjTax: number | null;
  singleTax: number | null;
  /** Null for a year with no saved baseline in Money App. */
  filedAs: FiledAs | null;
  breakdown: TaxBreakdown | null;
};

export type TaxDocument = {
  id: string;
  taxYear: number;
  driveUrl: string;
  label: string | null;
};

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

export function taxCenterReady(): boolean {
  return Boolean(apiUrl() && process.env.MONEYAPP_API_KEY);
}

/**
 * The filed-results table, straight from Money App. Never throws — Money App
 * being down or not yet connected comes back as an empty list with a reason,
 * because a page that says why it's empty beats one that won't load.
 */
export async function getTaxFilingResults(): Promise<{
  results: TaxFilingResult[];
  error: string | null;
}> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return { results: [], error: "This page isn't connected to the Money App yet." };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tax-center/export`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (res.status === 404) {
      return {
        results: [],
        error: "The Money App doesn't have the tax center feed yet.",
      };
    }
    if (!res.ok) throw new Error(await describeFailure(res));

    const body = await res.json();
    const rows = Array.isArray(body?.results) ? body.results : [];
    return { results: rows.map(normalize), error: null };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err.message : "Couldn't reach the Money App.",
    };
  }
}

/**
 * A failed response in words, not just a status number.
 *
 * Money App answers every error with `{ error: "…" }` saying what actually
 * went wrong — a missing column, an unresolvable user. This page used to
 * throw all of that away and show the bare status code, which turned a
 * one-glance diagnosis into an afternoon of guessing. Falls back to the
 * status when there's no readable body.
 */
async function describeFailure(res: Response): Promise<string> {
  let detail: string | null = null;
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error.trim()) detail = body.error.trim();
  } catch {
    // Not JSON — the status on its own is all we have.
  }
  if (res.status === 401) {
    return "The Money App didn't accept this app's key.";
  }
  return detail
    ? `Money App returned ${res.status}: ${detail}`
    : `Money App returned ${res.status}`;
}

/**
 * Fill in anything an older Money App deploy doesn't send yet. The two apps
 * ship separately, so this one has to survive a window where the feed is
 * still the thin version — missing detail becomes an empty list or null, and
 * the page just shows less rather than erroring.
 */
function normalize(row: Record<string, unknown>): TaxFilingResult {
  const r = row as Partial<TaxFilingResult> & Record<string, unknown>;
  return {
    year: Number(r.year),
    taxesPaid: r.taxesPaid ?? null,
    refundAmount: r.refundAmount ?? null,
    refundUsedFor: r.refundUsedFor ?? null,
    refunds: Array.isArray(r.refunds) ? r.refunds : [],
    jamieIncome: r.jamieIncome ?? null,
    chrisIncome: r.chrisIncome ?? null,
    mfjTax: r.mfjTax ?? null,
    singleTax: r.singleTax ?? null,
    filedAs: r.filedAs ?? null,
    breakdown: r.breakdown ?? null,
  };
}

// ── Google Drive links (stored here, not in Money App) ──────────────────────

export async function getTaxDocuments(): Promise<TaxDocument[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("tax_documents")
    .select("*")
    .order("tax_year", { ascending: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    taxYear: Number(row.tax_year),
    driveUrl: row.drive_url,
    label: row.label ?? null,
  }));
}

