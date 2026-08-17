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

/** One ledger account's share of a Schedule C line. */
export type ScheduleCLineAccount = {
  /** Full path, e.g. "Sales:Guest Passes". */
  path: string;
  amount: number;
  transactions: ScheduleCLineTx[];
};

export type ScheduleCLine = {
  code: string;
  label: string;
  scheduleCLine: string;
  classification: "income" | "cogs" | "expense";
  amount: number;
  /** One entry per transaction behind this line, newest first — lets a
   *  category expand to show what's actually in it. */
  transactions: ScheduleCLineTx[];
  /** The same money split by ledger account, largest first. THE ONLY correct
   *  way to group this line by account — see the note on `groupByAccount` in
   *  BusinessFinancesClient for what deriving it from `transactions` cost.
   *  Optional for the usual reason: it arrived in a later Money App, and one
   *  that predates it falls back to the old (wrong-ish) grouping rather than
   *  showing nothing. */
  accounts?: ScheduleCLineAccount[];
};

// These types are a hand-written mirror of what Money App's endpoint returns,
// so they describe what we HOPE arrives, not what the compiler has checked. A
// field added here ahead of the other app's deploy type-checks perfectly and
// then arrives undefined — which is how `accountPath` took the Business
// Finances page down. Anything Money App might not be sending yet is optional
// here, so the crash becomes a missing detail instead.
export type ScheduleCLineTx = {
  id: string;
  date: string;
  name: string | null;
  amount: number;
  /** Added later — absent from an older Money App's response. */
  memo?: string | null;
  /** The specific ledger account this booked to — one level more specific
   *  than the Schedule C line it sits under. Added later, so it can be
   *  missing; the transactions then list ungrouped rather than not at all. */
  accountPath?: string | null;
};

/** One named thing inside a cut's difference — a category and what it came to. */
export type CutItem = {
  label: string;
  amount: number;
  count: number;
  /** One entry per transaction behind this item, newest first. Optional —
   *  arrived in a later Money App; an older one's items just don't expand. */
  transactions?: ScheduleCLineTx[];
};

/** One reason two cuts of the same year disagree, itemized. */
export type CutBucket = { total: number; items: CutItem[] };

/** Schedule C for one year: the totals, the tax lines, profit by month. */
export type Rollup = {
  year: number;
  lines: ScheduleCLine[];
  income: number;
  /** Grant/forgiveness income — kept out of `income` so that figure reads
   *  real gym revenue, but still counted in `netProfit`. */
  otherIncome: number;
  cogs: number;
  expenses: number;
  /** Loan interest and finance charges — kept out of `expenses` so that figure
   *  reads real running cost, but still subtracted in `netProfit`. Optional
   *  for the reason above: it arrived in a later Money App, and a missing one
   *  should cost a line of interest, not the page. */
  financeCharges?: number;
  /** `income - cogs - expenses` — real revenue against real running costs,
   *  grants left out of both sides. What "Made a profit" now shows, since
   *  it's the figure that lines up with the Business P&L Budget's Operating
   *  Profit rather than `netProfit`, which folds grants back in. */
  operatingProfit: number;
  netProfit: number;
  untagged: { income: number; cogs: number; expense: number };
  untaggedAccountCount: number;
  /** Net profit per calendar month. Index 0 = January. */
  monthlyNetProfit: number[];
  fedHidden: boolean;
  fedDroppedCount: number;
  mistakesRemoved: boolean;
  operational: boolean;
  /** True when the transactions Chris marked "Remove from P&L" were left out —
   *  the Seller cut. Optional: it landed in Money App after this type did. */
  slimmed?: boolean;
  /** WHY this cut differs from the others, named category by category. Money
   *  App works these out; this app only decides which are "left out" and which
   *  are "counted", which depends on the cut on screen. Optional — an older
   *  Money App sends nothing and the lists simply don't render. */
  cutDetail?: {
    grants: CutBucket;
    interest: CutBucket;
    nonOperational: CutBucket;
    removedFromPl: CutBucket;
    /** Empty whenever Chris's tick-box hides FED from this app — Money App
     *  won't name what it's hiding, so there's nothing to render. */
    fed: CutBucket;
  };
  /** Everything drawn from Jamie's distribution tree for this period. Never
   *  part of `expenses`/`netProfit` under any cut — a distribution isn't a
   *  P&L expense — but a caller can subtract it to show "what's left after
   *  Jamie's paid". Optional: arrived in a later Money App. */
  jamieDistributions?: number;
  /** Same total as `jamieDistributions`, itemized by bucket (Taycan, Equinox,
   *  Charges, Transfers, Car Insurance, ...) with each bucket's transactions —
   *  what "Include all Jamie's Distributions" is actually made of. Optional:
   *  arrived in a later Money App than `jamieDistributions` did. */
  jamieDistributionsDetail?: CutBucket;
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
  /** The exact dates these figures cover — Money App's own answer, not a guess
   *  from the year. For all-time it spans every year that was actually summed,
   *  which is the only honest thing to caption the page with: the gym's first
   *  two months are here only if 2024 is ticked on this app's Shared access
   *  row. Optional for the usual reason — it arrived in a later Money App. */
  range?: { start: string; end: string };
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
  // Defaults to on, matching what this page always showed before the toggle
  // existed — every caller that doesn't care (Big Picture, Gym Story) keeps
  // reading the "how the gym actually runs" figures unless it asks otherwise.
  operational: boolean = true,
  // The Slim (seller's view) cut: drop the transactions Chris marked "Remove
  // from P&L". Off unless asked for, so no existing caller moves.
  slim: boolean = false,
  // Drop FED-tagged transactions. One-way: Money App ORs this with Chris's own
  // tick-box, so asking is only ever a request to see LESS.
  noFed: boolean = false,
): Promise<{ data: BusinessFinances | null; error: string | null }> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  const email = sharedEmail();
  if (!baseUrl || !apiKey || !email) {
    return { data: null, error: "This page isn't connected to the Money App yet." };
  }

  // Every request below asks for the same cut — building it in one place is
  // what keeps the all-time total honest, since a year fetched under different
  // switches than its siblings would be summed into the same figure as if it
  // weren't. `trim=slim` is the spelling Money App's own P&L screens use.
  //
  // `period=boxingrx` is on EVERY request, not just 2024's. Chris's books also
  // hold Montier's pre-acquisition history — 2023, and January through
  // November 26 of 2024, when the gym was still Jamie's: roughly $60k of income
  // against almost no cost. Asking for "2024" plainly would drag all of that
  // into this page's totals and make the gym look far better than it has ever
  // done. This is the same 11/27/24 cut Money App's own "BoxingRX" period
  // makes, and Money App owns the date, so the two can't drift. On every other
  // year it does nothing.
  const cutParams = (extra?: Record<string, string>) => {
    const p = new URLSearchParams({
      email,
      operational: String(operational),
      period: "boxingrx",
      ...extra,
    });
    if (slim) p.set("trim", "slim");
    if (noFed) p.set("fed", "hide");
    return p;
  };

  try {
    if (isAllTime) {
      // For all-time, fetch the first year to get the list of available years
      const params = cutParams();
      const firstRes = await fetch(
        `${baseUrl.replace(/\/$/, "")}/api/shared-access/portal?${params}`,
        { headers: { "x-api-key": apiKey }, cache: "no-store" },
      );

      if (!firstRes.ok) throw new Error(`Money App returned ${firstRes.status}`);
      const firstData = (await firstRes.json()) as BusinessFinances;

      // Only fetch years Money App itself vouches for via `years` — the tax
      // years ticked on this app's Shared access row. An earlier version also
      // force-requested 2024 when it wasn't on that list; Money App answered
      // with a year it WAS allowed instead of an error, and the all-time total
      // silently gained a duplicate year of income and expenses. Money App now
      // refuses a year that isn't shared (403), so that can't recur, and both
      // guards stay: this only ever asks for what it was told it may have.
      //
      // Which also means the year list IS the coverage. Tick 2024 on that row
      // and it appears here on the next load with nothing to redeploy; leave it
      // off and this page is missing the gym's first two months — so `years` is
      // what the caption below has to be built from, never a fixed start date.
      const allYearPromises = firstData.years.map(async (y) => {
        const yParams = cutParams({ year: String(y) });
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

    const params = cutParams();
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

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Every real calendar month from `start` through today, in order. This is what
 * makes the all-time monthly chart's x-axis — NOT one bucket per (year, month)
 * pair, which is what caused an earlier version to emit 24 entries for 2 years
 * and crash the chart (it indexes a fixed 12-entry MONTHS array by position).
 *
 * `start` comes from the years that were actually fetched, not from a fixed
 * Nov-2024. Hard-coding it made the array 22 slots long while only 20 of them
 * could ever hold data, and the headline divided by the 22 — so "averages to a
 * year" read $7,971 when the 20 months it really had say $8,768. A chart axis
 * has to describe the data behind it.
 */
function chronologicalMonths(start: { year: number; month: number }): { year: number; month: number }[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const out: { year: number; month: number }[] = [];
  for (let year = start.year; year <= currentYear; year++) {
    const startMonth = year === start.year ? start.month : 0;
    const endMonth = year === currentYear ? currentMonth : 11;
    for (let month = startMonth; month <= endMonth; month++) {
      out.push({ year, month });
    }
  }
  return out;
}

/**
 * The first month any of these years actually covers.
 *
 * Money App reports the exact window it read as `range`, so 2024 comes back
 * starting 11/27 rather than 01/01 under the BoxingRX cut. An older Money App
 * sends no range at all, hence the fall back to January of the earliest year.
 */
function coverageStart(years: BusinessFinances[]): { year: number; month: number; date: string } {
  const dates = years
    .map((y) => y.range?.start ?? `${y.year}-01-01`)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const date = dates[0] ?? `${Math.min(...years.map((y) => Number(y.year)))}-01-01`;
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1, date };
}

/**
 * Aggregate multiple years of data into one all-time view.
 */
function aggregateYears(years: BusinessFinances[]): BusinessFinances {
  if (years.length === 0) {
    throw new Error("No years to aggregate");
  }

  const first = years[0];
  const start = coverageStart(years);
  const months = chronologicalMonths(start);
  const monthLabels = months.map(({ year, month }, i) =>
    i === 0 || month === 0
      ? `${MONTH_LETTERS[month]}'${String(year).slice(2)}`
      : MONTH_LETTERS[month],
  );

  const aggregated: BusinessFinances = {
    view: first.view,
    year: "all-time",
    range: {
      start: start.date,
      end: years.map((y) => y.range?.end ?? `${y.year}-12-31`).sort().at(-1)!,
    },
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

  // Dedupe by `year` before summing anything — if Money App ever returns
  // two rollups tagged with the same year (e.g. a request for a year it
  // doesn't recognize falls back to another year's data instead of
  // erroring), summing the raw list would silently double-count that
  // year. This is what actually caused all-time income/expenses to come
  // in far above the real 22-month total.
  const byYear = new Map(rollups.map((r) => [r.year, r]));
  const unique = [...byYear.values()];

  const sumIncome = unique.reduce((sum, r) => sum + r.income, 0);
  const sumOtherIncome = unique.reduce((sum, r) => sum + r.otherIncome, 0);
  const sumCogs = unique.reduce((sum, r) => sum + r.cogs, 0);
  const sumExpenses = unique.reduce((sum, r) => sum + r.expenses, 0);
  const sumFinanceCharges = unique.reduce((sum, r) => sum + (r.financeCharges ?? 0), 0);
  const sumJamieDistributions = unique.reduce((sum, r) => sum + (r.jamieDistributions ?? 0), 0);

  // Same category across two years is one row in the all-time list, not two.
  const mergeBuckets = (pick: (r: Rollup) => CutBucket | undefined): CutBucket => {
    const items = new Map<string, CutItem>();
    let total = 0;
    for (const r of unique) {
      const b = pick(r);
      if (!b) continue;
      total += b.total;
      for (const item of b.items) {
        const existing = items.get(item.label);
        if (existing) {
          existing.amount += item.amount;
          existing.count += item.count;
          if (item.transactions) {
            existing.transactions = [...(existing.transactions ?? []), ...item.transactions];
          }
        } else {
          items.set(item.label, { ...item, transactions: item.transactions ? [...item.transactions] : undefined });
        }
      }
    }
    return {
      total,
      items: [...items.values()]
        .map((item) => ({
          ...item,
          transactions: item.transactions
            ?.slice()
            .sort((a, b) => b.date.localeCompare(a.date)),
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    };
  };

  const monthlyNetProfit = months.map(
    ({ year, month }) => byYear.get(year)?.monthlyNetProfit[month] ?? 0,
  );

  return {
    year: -1, // Special value for all-time
    lines: unique.flatMap((r) => r.lines),
    income: sumIncome,
    otherIncome: sumOtherIncome,
    cogs: sumCogs,
    expenses: sumExpenses,
    financeCharges: sumFinanceCharges,
    operatingProfit: sumIncome - sumCogs - sumExpenses,
    // Interest belongs in the bottom line even though it's carved out of
    // `expenses` — this used to drop it, so all-time net profit read better
    // than it was by every dollar of loan interest the gym has ever paid.
    // Same formula Money App uses per year (see `netProfit` in its
    // tax-actuals-server), so a year and the all-time total agree.
    netProfit: sumIncome + sumOtherIncome - sumCogs - sumExpenses - sumFinanceCharges,
    untagged: unique.reduce(
      (sum, r) => ({
        income: sum.income + r.untagged.income,
        cogs: sum.cogs + r.untagged.cogs,
        expense: sum.expense + r.untagged.expense,
      }),
      { income: 0, cogs: 0, expense: 0 },
    ),
    untaggedAccountCount: Math.max(...unique.map((r) => r.untaggedAccountCount), 0),
    monthlyNetProfit,
    fedHidden: unique.some((r) => r.fedHidden),
    fedDroppedCount: unique.reduce((sum, r) => sum + r.fedDroppedCount, 0),
    mistakesRemoved: unique.some((r) => r.mistakesRemoved),
    operational: unique.some((r) => r.operational),
    slimmed: unique.some((r) => r.slimmed),
    jamieDistributions: sumJamieDistributions,
    jamieDistributionsDetail: mergeBuckets((r) => r.jamieDistributionsDetail),
    cutDetail: {
      grants: mergeBuckets((r) => r.cutDetail?.grants),
      interest: mergeBuckets((r) => r.cutDetail?.interest),
      nonOperational: mergeBuckets((r) => r.cutDetail?.nonOperational),
      removedFromPl: mergeBuckets((r) => r.cutDetail?.removedFromPl),
      fed: mergeBuckets((r) => r.cutDetail?.fed),
    },
  };
}

/** Does any profit figure survive Chris's tick-boxes? */
export function showsProfit(view: ViewSettings): boolean {
  return view.show_headline || view.show_schedule_c || view.show_monthly;
}
