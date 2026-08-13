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
  year: number;
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
): Promise<{ data: BusinessFinances | null; error: string | null }> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  const email = sharedEmail();
  if (!baseUrl || !apiKey || !email) {
    return { data: null, error: "This page isn't connected to the Money App yet." };
  }

  const params = new URLSearchParams({ email });
  if (year) params.set("year", String(year));

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/shared-access/portal?${params}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );

    if (res.status === 403) {
      // The row is gone, switched off, or run out — the one failure Chris causes
      // on purpose, so it says that rather than blaming the connection.
      return {
        data: null,
        error: "This app isn't on the Money App's shared-access list right now.",
      };
    }
    if (res.status === 404) {
      // A Money App that predates the endpoint. Says what to do, since the fix
      // is a deploy over there and nothing here.
      return {
        data: null,
        error: "The Money App doesn't have the shared-access feed yet.",
      };
    }
    if (!res.ok) throw new Error(`Money App returned ${res.status}`);

    return { data: (await res.json()) as BusinessFinances, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Couldn't reach the Money App.",
    };
  }
}

/** Does any profit figure survive Chris's tick-boxes? */
export function showsProfit(view: ViewSettings): boolean {
  return view.show_headline || view.show_schedule_c || view.show_monthly;
}
