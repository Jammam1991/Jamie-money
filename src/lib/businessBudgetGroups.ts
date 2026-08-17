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
// This reads Money App's `/api/business/budget` — documented there as
// "identical to the in-app P&L (Budget) screen" and already proven from an
// API-key context (it's what the gym dashboard's own mirrored Budget section
// calls) — one request per calendar month, then sums by category across the
// requested stretch. Same MONEYAPP_API_URL/MONEYAPP_API_KEY the rest of this
// app already holds; no new setup.

export type BudgetCategoryRow = { category: string; amount: number };
export type BudgetGroupTotal = { total: number; rows: BudgetCategoryRow[] };
export type BudgetGroups = { fixed: BudgetGroupTotal; variable: BudgetGroupTotal };

type BudgetApiRow = { category: string; posted: number };
type BudgetApiGroup = { key: string; rows: BudgetApiRow[] };
type BudgetApiResponse = { groups: BudgetApiGroup[] };

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

/** "2024-11" through "2026-08", inclusive — never past the current month,
 *  since asking Money App for a month that hasn't happened yet is a wasted
 *  request (it would just come back all zeros). */
function monthsBetween(start: string, end: string): string[] {
  const [sy, sm] = start.slice(0, 7).split("-").map(Number);
  const today = new Date();
  const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const cappedEnd = end.slice(0, 7) > currentMonth ? currentMonth : end.slice(0, 7);
  const [ey, em] = cappedEnd.split("-").map(Number);

  const months: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

function emptyGroups(): BudgetGroups {
  return { fixed: { total: 0, rows: [] }, variable: { total: 0, rows: [] } };
}

/**
 * Fixed/Variable expense categories for one stretch of time, summed across
 * however many calendar months that spans. Null when Money App isn't
 * reachable or isn't connected — the caller falls back to the Schedule C
 * breakdown rather than showing a broken section.
 */
export async function getBudgetGroups(
  range: { start: string; end: string } | undefined,
  opts: { slim: boolean; noFed: boolean },
): Promise<BudgetGroups | null> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey || !range) return null;

  const months = monthsBetween(range.start, range.end);
  if (months.length === 0) return emptyGroups();

  const params = (month: string) => {
    const p = new URLSearchParams({ month });
    if (opts.slim) p.set("trim", "slim");
    if (opts.noFed) p.set("fed", "hide");
    return p;
  };

  const results = await Promise.all(
    months.map(async (month) => {
      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, "")}/api/business/budget?${params(month)}`,
          { headers: { "x-api-key": apiKey }, cache: "no-store" },
        );
        if (!res.ok) return null;
        return (await res.json()) as BudgetApiResponse;
      } catch {
        return null;
      }
    }),
  );

  // A month Money App couldn't answer for just doesn't contribute — same
  // "missing, not zero" rule the gym-pay months use, but at the row level
  // rather than failing the whole section over one bad month.
  const merge = (key: "fixed" | "variable"): BudgetGroupTotal => {
    const byCategory = new Map<string, number>();
    for (const r of results) {
      const group = r?.groups.find((g) => g.key === key);
      if (!group) continue;
      for (const row of group.rows) {
        if (row.posted === 0) continue;
        byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.posted);
      }
    }
    const rows = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { total: rows.reduce((s, r) => s + r.amount, 0), rows };
  };

  return { fixed: merge("fixed"), variable: merge("variable") };
}
