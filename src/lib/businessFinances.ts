// ── The gym's books, read through Money App's Shared access list ─────────────
// Money App has a "Shared access" screen where Chris adds someone by email and
// ticks what they're allowed to see: the big totals, Schedule C line by line,
// profit by month, the transactions he flagged, his notes, his documents, which
// tax years. His accountant has a row there. This app has one too.
//
// So the permission does NOT live in this file, and it isn't a page gate either
// — it's a row in Money App that Chris edits. Untick a section there and it
// stops arriving here on the next load; revoke the row and this page goes dark
// on its own. Nothing below can widen it.
//
// Nothing is saved. Every load asks Money App fresh, which is what makes a
// change on that screen land immediately — and means there's no table to create
// and no sync to remember.
//
// Required env vars (Vercel → jamie-money → Settings → Environment):
//   MONEYAPP_API_URL   — Money App's base URL (MONEYAPP_URL is accepted too)
//   MONEYAPP_API_KEY   — the same key the debt sync already uses
//   MONEYAPP_SHARED_EMAIL — the address Chris put on the Shared access list for
//                       this app. Says WHICH row's tick-boxes apply, so it has
//                       to be this app's own address, not Chris's and not the
//                       accountant's.

export type ScheduleCLine = {
  code: string;
  label: string;
  scheduleCLine: string;
  classification: "income" | "cogs" | "expense";
  amount: number;
};

/** Schedule C for one year: the totals, the tax lines, profit by month. */
export type Rollup = {
  year: number;
  lines: ScheduleCLine[];
  income: number;
  cogs: number;
  expenses: number;
  netProfit: number;
  untagged: { income: number; cogs: number; expense: number };
  untaggedAccountCount: number;
  /** Net profit per calendar month. Index 0 = January. */
  monthlyNetProfit: number[];
  fedHidden: boolean;
  fedDroppedCount: number;
  mistakesRemoved: boolean;
};

/** One transaction Chris marked as a start-up mistake in Money App. */
export type Mistake = {
  id: string;
  date: string;
  name: string | null;
  memo: string | null;
  amount: number;
  /** The part of it that was the mistake — all of it, or the marked slice. */
  mistakeAmount: number;
  full: boolean;
  /** Which Schedule C line it's booked to — same wording as "Line by line". */
  category: string;
};

/** The same year with the mistakes taken back out. */
export type MistakeView = {
  rollup: Rollup;
  mistakes: Mistake[];
  /** How much better net profit looks once they're gone. */
  profitDifference: number;
};

/** Chris's tick-boxes for this app, straight from the Shared access row. */
export type ViewSettings = {
  show_headline: boolean;
  show_schedule_c: boolean;
  show_monthly: boolean;
  show_flagged: boolean;
  show_notes: boolean;
  show_documents: boolean;
  show_csv: boolean;
  hide_fed: boolean;
  allow_uploads: boolean;
  allowed_years: number[] | null;
};

export type FlaggedTx = {
  id: string;
  date: string;
  name: string | null;
  memo: string | null;
  amount: number;
  isIncome: boolean;
};

export type Note = {
  id: string;
  title: string;
  body: string | null;
  kind: "question" | "note" | "todo";
  status: "open" | "asked" | "resolved";
  cpa_answer: string | null;
};

export type Doc = {
  id: string;
  file_name: string;
  label: string | null;
  created_at: string;
  /** A short-lived signed link, minted by Money App on this load. */
  url: string | null;
};

export type BusinessFinances = {
  view: ViewSettings;
  year: number | "all-time";
  month?: number;
  /** The years this app is allowed to open, newest first. */
  years: number[];
  /** The last business transaction in the year — how current the books are. */
  throughDate: string | null;
  actual: Rollup;
  /** Null when no profit figure is ticked on, so there's nothing to re-cut. */
  noMistakes: MistakeView | null;
  flagged: FlaggedTx[];
  notes: Note[];
  documents: Doc[];
  /**
   * Only set for "all-time": one label per entry in actual.monthlyNetProfit
   * (and noMistakes.rollup.monthlyNetProfit), since that array spans more
   * than 12 months and the plain Jan–Dec labels no longer apply.
   */
  monthLabels?: string[];
};

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

function sharedEmail(): string | undefined {
  return process.env.MONEYAPP_SHARED_EMAIL?.trim() || undefined;
}

/** All three env vars set? Until then the page says so instead of erroring. */
export function businessFinancesReady(): boolean {
  return Boolean(apiUrl() && process.env.MONEYAPP_API_KEY && sharedEmail());
}

/**
 * One year of the gym's books, or a plain-words reason there aren't any.
 *
 * Never throws. Money App being down, the row being revoked, the setup being
 * half-done — all of them come back as `error`, because a page that says why
 * it's empty is worth far more than one that won't load.
 */
export async function getBusinessFinances(
  year?: number,
  month?: number,
  isAllTime?: boolean,
): Promise<{ data: BusinessFinances | null; error: string | null }> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  const email = sharedEmail();
  if (!baseUrl || !apiKey || !email) {
    return { data: null, error: "This page isn't connected to the Money App yet." };
  }

  try {
    if (isAllTime) {
      // For all-time, fetch the first year to get the list of available years
      const params = new URLSearchParams({ email });
      const firstRes = await fetch(
        `${baseUrl.replace(/\/$/, "")}/api/shared-access/portal?${params}`,
        { headers: { "x-api-key": apiKey }, cache: "no-store" },
      );

      if (!firstRes.ok) throw new Error(`Money App returned ${firstRes.status}`);
      const firstData = (await firstRes.json()) as BusinessFinances;

      // The business started Nov 27, 2024 — make sure that year is fetched
      // even if Money App's own "years" list starts later (e.g. it only
      // lists years with a full-year's worth of tax-relevant data).
      const yearsToFetch = Array.from(new Set([...firstData.years, BUSINESS_START_YEAR]));

      // Fetch all years and aggregate
      const allYearPromises = yearsToFetch.map(async (y) => {
        const yParams = new URLSearchParams({ email, year: String(y) });
        const res = await fetch(
          `${baseUrl.replace(/\/$/, "")}/api/shared-access/portal?${yParams}`,
          { headers: { "x-api-key": apiKey }, cache: "no-store" },
        );
        if (!res.ok) return null;
        return (await res.json()) as BusinessFinances;
      });

      const allYears = (await Promise.all(allYearPromises)).filter(Boolean) as BusinessFinances[];

      if (allYears.length === 0) {
        return { data: null, error: "Couldn't fetch any years for all-time view." };
      }

      // Aggregate the data
      const aggregated = aggregateYears(allYears);
      return { data: aggregated, error: null };
    }

    const params = new URLSearchParams({ email });
    if (year) params.set("year", String(year));
    if (month && Number.isFinite(month) && month >= 1 && month <= 12) {
      params.set("month", String(month));
    }

    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/shared-access/portal?${params}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );

    if (res.status === 403) {
      return {
        data: null,
        error: "This app isn't on the Money App's shared-access list right now.",
      };
    }
    if (res.status === 404) {
      return {
        data: null,
        error: "The Money App doesn't have the shared-access feed yet.",
      };
    }
    if (!res.ok) throw new Error(`Money App returned ${res.status}`);

    const data = (await res.json()) as BusinessFinances;
    if (month) {
      data.month = month;
    }
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Couldn't reach the Money App.",
    };
  }
}

const BUSINESS_START_YEAR = 2024;
const BUSINESS_START_MONTH = 10; // November, 0-indexed
const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Every real calendar month from the business's start (Nov 2024) through
 * today, in order. This is what makes the all-time monthly chart's x-axis —
 * NOT one bucket per (year, month) pair, which is what caused the previous
 * version to sometimes emit 24 entries for 2 years and crash the chart (it
 * indexes a fixed 12-entry MONTHS array by position).
 */
function chronologicalMonths(): { year: number; month: number }[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const out: { year: number; month: number }[] = [];
  for (let year = BUSINESS_START_YEAR; year <= currentYear; year++) {
    const startMonth = year === BUSINESS_START_YEAR ? BUSINESS_START_MONTH : 0;
    const endMonth = year === currentYear ? currentMonth : 11;
    for (let month = startMonth; month <= endMonth; month++) {
      out.push({ year, month });
    }
  }
  return out;
}

/**
 * Aggregate multiple years of data into one all-time view.
 */
function aggregateYears(years: BusinessFinances[]): BusinessFinances {
  if (years.length === 0) {
    throw new Error("No years to aggregate");
  }

  const first = years[0];
  const months = chronologicalMonths();
  const monthLabels = months.map(({ year, month }) =>
    month === BUSINESS_START_MONTH || month === 0
      ? `${MONTH_LETTERS[month]}'${String(year).slice(2)}`
      : MONTH_LETTERS[month],
  );

  const aggregated: BusinessFinances = {
    view: first.view,
    year: "all-time",
    years: first.years,
    throughDate: first.throughDate, // Most recent date
    actual: aggregateRollups(
      years.map((y) => y.actual),
      months,
    ),
    noMistakes: years.some((y) => y.noMistakes)
      ? {
          rollup: aggregateRollups(
            years.map((y) => y.noMistakes?.rollup || y.actual),
            months,
          ),
          mistakes: years.flatMap((y) => y.noMistakes?.mistakes || []),
          profitDifference: years.reduce((sum, y) => sum + (y.noMistakes?.profitDifference || 0), 0),
        }
      : null,
    flagged: years.flatMap((y) => y.flagged),
    notes: years.flatMap((y) => y.notes),
    documents: years.flatMap((y) => y.documents),
    monthLabels,
  };

  return aggregated;
}

/**
 * Combine multiple rollup objects (from different years) into one aggregated
 * rollup. `months` fixes the exact chronological months to emit in
 * monthlyNetProfit — every rollup is read by (year, month) lookup rather than
 * concatenated, so the result always has exactly `months.length` entries,
 * never one bucket per source year.
 */
function aggregateRollups(rollups: Rollup[], months: { year: number; month: number }[]): Rollup {
  if (rollups.length === 0) {
    throw new Error("No rollups to aggregate");
  }

  const sumIncome = rollups.reduce((sum, r) => sum + r.income, 0);
  const sumCogs = rollups.reduce((sum, r) => sum + r.cogs, 0);
  const sumExpenses = rollups.reduce((sum, r) => sum + r.expenses, 0);

  const byYear = new Map(rollups.map((r) => [r.year, r]));
  const monthlyNetProfit = months.map(
    ({ year, month }) => byYear.get(year)?.monthlyNetProfit[month] ?? 0,
  );

  return {
    year: -1, // Special value for all-time
    lines: rollups.flatMap((r) => r.lines),
    income: sumIncome,
    cogs: sumCogs,
    expenses: sumExpenses,
    netProfit: sumIncome - sumCogs - sumExpenses,
    untagged: rollups.reduce(
      (sum, r) => ({
        income: sum.income + r.untagged.income,
        cogs: sum.cogs + r.untagged.cogs,
        expense: sum.expense + r.untagged.expense,
      }),
      { income: 0, cogs: 0, expense: 0 },
    ),
    untaggedAccountCount: Math.max(...rollups.map((r) => r.untaggedAccountCount), 0),
    monthlyNetProfit,
    fedHidden: rollups.some((r) => r.fedHidden),
    fedDroppedCount: rollups.reduce((sum, r) => sum + r.fedDroppedCount, 0),
    mistakesRemoved: rollups.some((r) => r.mistakesRemoved),
  };
}

/** Does any profit figure survive Chris's tick-boxes? */
export function showsProfit(view: ViewSettings): boolean {
  return view.show_headline || view.show_schedule_c || view.show_monthly;
}
