// ── Expense categories, grouped the way Chris's own P&L (Budget) screen
//    groups them ──────────────────────────────────────────────────────────
// Business Finances' "Total Expenses" used to break down by Schedule C tax
// line (lib/tax-actuals-server.ts's rollup) — a different, coarser
// categorization than the one on Chris's own Budget page, which splits every
// expense into "Fixed" (Gross Rent, CAM, Liability insurance, ...) and
// "Variable" (Targeting, individual contractors, Merchant account fees, ...).
// The two never agreed on category names, which made "why don't these two
// lists look alike" as confusing as the totals used to be.
//
// This reads Money App's `/api/business/budget-range` — a range-aware sibling
// of `/api/business/budget` (documented there as "identical to the in-app
// P&L (Budget) screen") built specifically for this page: it sums the same
// Fixed/Variable category data across every month in the range on Money
// App's own side, so this is ONE request no matter how long the range is.
// An earlier version called the single-month endpoint once per month itself
// (22 requests for "All time") — each paying its own cross-deployment
// network hop — which was the slow part of this page loading, especially
// noticeable every time the date filter changed. Same MONEYAPP_API_URL/
// MONEYAPP_API_KEY the rest of this app already holds; no new setup.

export type BudgetCategoryRow = { category: string; amount: number };
export type BudgetGroupTotal = { total: number; rows: BudgetCategoryRow[] };
export type BudgetGroups = { fixed: BudgetGroupTotal; variable: BudgetGroupTotal };

type BudgetRangeResponse = { fixed: BudgetGroupTotal; variable: BudgetGroupTotal };

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

/**
 * Fixed/Variable expense categories for one stretch of time. Null when
 * Money App isn't reachable, isn't connected, or is too old to have this
 * endpoint — the caller falls back to the Schedule C breakdown rather than
 * showing a broken section.
 */
export async function getBudgetGroups(
  range: { start: string; end: string } | undefined,
  opts: { slim: boolean; noFed: boolean },
): Promise<BudgetGroups | null> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey || !range) return null;

  const params = new URLSearchParams({ start: range.start, end: range.end });
  if (opts.slim) params.set("trim", "slim");
  if (opts.noFed) params.set("fed", "hide");

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/business/budget-range?${params}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as BudgetRangeResponse;
    return { fixed: data.fixed, variable: data.variable };
  } catch {
    return null;
  }
}
