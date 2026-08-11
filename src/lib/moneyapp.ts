import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreditInquiry,
  CreditSummary,
  NegativeItem,
  ReportAccount,
  ScoreReasons,
} from "./creditReport";

// ── Money App debt + credit-score feed ────────────────────────────────────────
// Pulls Jamie's real debt balances and latest credit score from the separate
// Money App project via its API, and writes the debts into our own `debts`
// table (keyed by moneyapp_debt_id, so a re-sync updates in place instead of
// piling up duplicates). The credit score has no natural home of its own, so
// it's stashed in `settings` under the key "moneyapp_fico".
//
// Required env vars (add in Vercel → jamie-money → Settings → Environment):
//   MONEYAPP_API_URL — Money App's base URL, e.g. https://moneyapp.example.com
//                       (MONEYAPP_URL is accepted too — Money App's own notes
//                       call it that, and a name mismatch just looks like the
//                       feature is switched off)
//   MONEYAPP_API_KEY — an API key generated in the Money App repo via
//                       `node scripts/generate-api-key.mjs "jamie-money integration"`
//
// Until both are set, moneyAppReady() is false and the app quietly skips this
// feature (manual entry and the bank feed still work).

export type MoneyAppFico = { score: number; date: string };
export type MoneyAppSyncResult = {
  // How many accounts Money App sent us, before any of them were saved. The
  // one number that tells "Money App has nothing under Jamie" apart from "it
  // sent plenty and every save failed" — which look identical from `synced`.
  received: number;
  synced: number;
  fico: MoneyAppFico | null;
  scores: number; // credit scores mirrored into moneyapp_fico_history
  snapshots: number; // balance snapshots mirrored into moneyapp_debt_snapshots
  reports: number; // whole credit reports mirrored into moneyapp_credit_reports
  loans: number; // private loans mirrored into debt_transactions
  // Writes that failed. Money App was reached fine, so this isn't a hard error
  // — but the page would sit empty with no clue why, which is worse than an
  // ugly message.
  problems: string[];
  error?: string;
};

type ExportDebt = {
  id: string;
  name: string;
  type: string;
  balance: number;
  apr: number;
  minPayment: number;
  // Added later, with the full credit report — an older Money App won't send them.
  openedDate?: string | null;
  creditReportDay?: number | null;
  notes?: string | null;
};
type ExportScore = { date: string; score: number; note: string | null };
type ExportSnapshot = {
  debtId: string;
  date: string;
  balance: number;
  missedPayment: boolean;
  note: string | null;
};
// One whole parsed credit report, exactly as Money App's Credit Report page
// reads it.
type ExportReport = {
  date: string;
  score: number | null;
  reasons: ScoreReasons | null;
  negatives: NegativeItem[] | null;
  summary: CreditSummary | null;
  inquiries: CreditInquiry[] | null;
  accounts: ReportAccount[] | null;
};
type ExportResponse = {
  debts: ExportDebt[];
  fico: MoneyAppFico | null;
  // All added later — an older Money App won't send them.
  ficoHistory?: ExportScore[];
  history?: ExportSnapshot[];
  creditReports?: ExportReport[];
};

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

export function moneyAppReady(): boolean {
  return Boolean(apiUrl() && process.env.MONEYAPP_API_KEY);
}

export async function syncMoneyAppDebts(
  supabase: SupabaseClient,
): Promise<MoneyAppSyncResult> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return {
      received: 0,
      synced: 0,
      fico: null,
      scores: 0,
      snapshots: 0,
      reports: 0,
      loans: 0,
      problems: [],
      error: "Money App isn't connected yet.",
    };
  }

  let parsed: ExportResponse;
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/debt/export?person=jamie`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Money App returned ${res.status}`);
    parsed = await res.json();
  } catch (err) {
    return {
      received: 0,
      synced: 0,
      fico: null,
      scores: 0,
      snapshots: 0,
      reports: 0,
      loans: 0,
      problems: [],
      error: err instanceof Error ? err.message : "Couldn't reach Money App.",
    };
  }

  // A response that isn't shaped the way we expect is a reachable-but-broken
  // Money App, not a crash — treat it as "sent nothing" and say so.
  const debts = Array.isArray(parsed.debts) ? parsed.debts : [];

  // Which of these accounts already have a row? Keep it, update in place.
  const ids = debts.map((d) => d.id);
  const { data: existing } = ids.length
    ? await supabase
        .from("debts")
        .select("id, moneyapp_debt_id")
        .in("moneyapp_debt_id", ids)
    : { data: [] as { id: string; moneyapp_debt_id: string }[] };
  const existingMap = new Map(
    (existing ?? []).map((r) => [r.moneyapp_debt_id as string, r.id as string]),
  );

  const base = Math.floor(Date.now() / 1000);
  const problems: string[] = [];
  let synced = 0;
  for (let i = 0; i < debts.length; i++) {
    const d = debts[i];
    const existingId = existingMap.get(d.id);
    // The account details the Credit Report page shows. Sent only by a Money
    // App new enough to have them, so they're left out of the write entirely
    // when they're missing rather than blanking what's already saved.
    const details: Record<string, unknown> = {};
    if (d.type !== undefined) details.debt_type = d.type;
    if (d.openedDate !== undefined) details.opened_date = d.openedDate;
    if (d.creditReportDay !== undefined) details.credit_report_day = d.creditReportDay;
    if (d.notes !== undefined) details.notes = d.notes;

    const write = (extra: Record<string, unknown>) =>
      existingId
        ? supabase
            .from("debts")
            .update({
              name: d.name,
              balance: d.balance,
              apr: d.apr,
              min_payment: d.minPayment,
              monthly: d.minPayment,
              ...extra,
            })
            .eq("id", existingId)
        : supabase.from("debts").insert({
            name: d.name,
            balance: d.balance,
            apr: d.apr,
            min_payment: d.minPayment,
            monthly: d.minPayment,
            paid_pct: 0,
            source: "moneyapp",
            moneyapp_debt_id: d.id,
            sort: base + i,
            ...extra,
          });

    let { error } = await write(details);
    // The detail columns arrive with credit_report_setup.sql. Until that's been
    // run they don't exist, and insisting on them would stop the balances from
    // updating too — so drop them and write the numbers anyway.
    if (error && missingSchema(error.message)) {
      const retry = await write({});
      if (retry.error) {
        // Report what the plain write hit, not the detail columns — that's the
        // error actually standing in the way.
        error = retry.error;
      } else {
        note(problems, "the account details", error.message);
        error = null;
      }
    }
    if (error) note(problems, "the accounts", error.message);
    else synced++;
  }

  if (parsed.fico) {
    await supabase.from("settings").upsert({
      key: "moneyapp_fico",
      value: JSON.stringify(parsed.fico),
      updated_at: new Date().toISOString(),
    });
  }

  const { scores, snapshots, reports } = await mirrorCreditHistory(
    supabase,
    parsed,
    problems,
  );

  const loans = await mirrorPrivateLoans(supabase, baseUrl, apiKey, problems);

  return {
    received: debts.length,
    synced,
    fico: parsed.fico ?? null,
    scores,
    snapshots,
    reports,
    loans,
    problems,
  };
}

// ── The money lent to Jamie privately ────────────────────────────────────────
// These aren't credit accounts, so they're nowhere in the credit report and
// nowhere in the debt export — they only exist as "Private Loans:Jamie"
// transactions in Money App's ledger. They're what the "New debt added this
// year" panel is meant to show, and why it read $0: the table behind it was
// filled in by hand and never filled.
//
// Each row is keyed to the Money App transaction it came from, so re-syncing
// updates in place instead of adding another copy of every loan.
//
// A repayment comes through as a negative amount. It's kept rather than
// dropped, because a year's figure should be what was actually borrowed net of
// what went back.

type ExportLoan = {
  id: string;
  date: string;
  payee: string | null;
  // Which bank or card the money left from, so a loan can be checked against a
  // statement. Sent only by a Money App new enough to include it.
  account?: string | null;
  amount: number; // already flipped: positive = borrowed, negative = repaid
};

async function mirrorPrivateLoans(
  supabase: SupabaseClient,
  baseUrl: string,
  apiKey: string,
  problems: string[],
): Promise<number> {
  let loans: ExportLoan[];
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/debt/private-loans?person=jamie`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    // A Money App too old to have this endpoint 404s. That's not a failure
    // worth shouting about — everything else synced fine.
    if (res.status === 404) return 0;
    if (!res.ok) throw new Error(`Money App returned ${res.status}`);
    const body = await res.json();
    loans = Array.isArray(body?.loans) ? body.loans : [];
  } catch (err) {
    note(
      problems,
      "the private loans",
      err instanceof Error ? err.message : "couldn't reach Money App",
    );
    return 0;
  }

  if (loans.length === 0) return 0;

  const { error } = await supabase.from("debt_transactions").upsert(
    firstPerKey(loans, (l) => l.id).map((l) => ({
      moneyapp_tx_id: l.id,
      tx_date: l.date,
      description: l.payee?.trim() || "Private loan",
      amount: l.amount,
      // The account it came out of, so it can be checked against a statement.
      // An older Money App doesn't send one, and "Private loan" at least says
      // where the row came from.
      source: l.account?.trim() || "Private loan",
    })),
    { onConflict: "moneyapp_tx_id" },
  );
  if (error) {
    note(problems, "the private loans", error.message, "private_loans.sql");
    return 0;
  }
  return loans.length;
}

// ── Pulling on its own, without the button ───────────────────────────────────
// The Debt page calls this on every load. Money App is the source of truth for
// the accounts it knows about, so the numbers should be current whether or not
// anyone remembered to press Sync.
//
// It's throttled, because a page load shouldn't wait on another app's API every
// single time: a good pull holds for an hour, a failed one is retried after ten
// minutes. The last attempt is remembered in `settings` under
// "moneyapp_last_sync".
//
// Nothing here ever throws. A sync that can't run is a stale number on the
// page, which is far better than a page that won't load at all.

const SYNC_STATE_KEY = "moneyapp_last_sync";
const FRESH_FOR_MS = 60 * 60 * 1000; // a good pull holds for an hour
const RETRY_AFTER_MS = 10 * 60 * 1000; // a failed one is retried sooner

type SyncState = { at: string; ok: boolean };

export async function autoSyncMoneyAppDebts(
  supabase: SupabaseClient,
): Promise<void> {
  if (!moneyAppReady()) return;
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SYNC_STATE_KEY)
      .maybeSingle();

    if (data?.value) {
      let state: SyncState | null = null;
      try {
        state = JSON.parse(String(data.value)) as SyncState;
      } catch {
        state = null; // unreadable marker — just pull again
      }
      if (state?.at) {
        const age = Date.now() - new Date(state.at).getTime();
        const holdFor = state.ok ? FRESH_FOR_MS : RETRY_AFTER_MS;
        if (age >= 0 && age < holdFor) return;
      }
    }

    const result = await syncMoneyAppDebts(supabase);
    const ok = !result.error && result.problems.length === 0;
    await supabase.from("settings").upsert({
      key: SYNC_STATE_KEY,
      value: JSON.stringify({ at: new Date().toISOString(), ok } satisfies SyncState),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Money App being down, or the settings table not existing yet, must not
    // take the Debt page down with it.
  }
}

// Postgres/PostgREST for "that table or column isn't there".
function missingSchema(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

// Record a failed write once per kind, in words rather than Postgres-speak.
// A missing table or column means the setup SQL hasn't been run yet, which is
// far and away the most likely reason a pull saves nothing — so the message
// names the file to run, and it has to be the right file for what failed.
function note(
  problems: string[],
  what: string,
  message: string,
  sqlFile = "credit_report_setup.sql",
) {
  const line = missingSchema(message)
    ? `Couldn't save ${what} — the database isn't set up yet. Run supabase/${sqlFile}. (${message})`
    : `Couldn't save ${what} — ${message}`;
  if (!problems.includes(line)) problems.push(line);
}

// Keep the first row for each key and drop the rest.
//
// An upsert is one statement, and Postgres refuses to let one statement touch
// the same row twice — two rows sharing a conflict key fail the whole batch
// with "ON CONFLICT DO UPDATE command cannot affect row a second time". Money
// App legitimately has repeats: two credit reports pulled on one day, or an
// account listed twice on the same report. So the duplicates are thinned here
// rather than treated as bad data.
//
// First wins, so callers hand these over newest-first and the surviving row is
// the most recent reading.
function firstPerKey<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return kept;
}

// Copy Money App's credit-score history and balance snapshots into our two
// mirror tables, which is everything the Credit Report page reads.
//
// Both are upserts rather than a wipe-and-refill: a sync that only returns
// part of the history (or an older Money App that returns none of it) then
// leaves what's already here alone instead of emptying the page.
async function mirrorCreditHistory(
  supabase: SupabaseClient,
  parsed: ExportResponse,
  problems: string[],
): Promise<{ scores: number; snapshots: number; reports: number }> {
  const now = new Date().toISOString();
  let scores = 0;
  let snapshots = 0;
  let reports = 0;

  // Money App sends the scores oldest-first, so it's reversed before thinning —
  // two readings on one date keep the later one.
  const history = firstPerKey([...(parsed.ficoHistory ?? [])].reverse(), (h) => h.date);
  if (history.length > 0) {
    const { error } = await supabase.from("moneyapp_fico_history").upsert(
      history.map((h) => ({
        scored_on: h.date,
        score: h.score,
        note: h.note,
        synced_at: now,
      })),
      { onConflict: "scored_on" },
    );
    if (error) note(problems, "the score history", error.message);
    else scores = history.length;
  }

  // Already newest-first. One account can appear twice on the same date — two
  // reports imported in one day — and that pair would fail the whole batch.
  const rows = firstPerKey(parsed.history ?? [], (r) => `${r.debtId}|${r.date}`);
  if (rows.length > 0) {
    const { error } = await supabase.from("moneyapp_debt_snapshots").upsert(
      rows.map((r) => ({
        moneyapp_debt_id: r.debtId,
        snapshot_date: r.date,
        balance: r.balance,
        missed_payment: r.missedPayment,
        note: r.note,
        synced_at: now,
      })),
      { onConflict: "moneyapp_debt_id,snapshot_date" },
    );
    if (error) note(problems, "the balance history", error.message);
    else snapshots = rows.length;
  }

  // The reports themselves — score factors, negative items, the summary, the
  // inquiries and the bureau's account list, stored as Money App parsed them.
  const parsedReports = firstPerKey(parsed.creditReports ?? [], (r) => r.date);
  if (parsedReports.length > 0) {
    const { error } = await supabase.from("moneyapp_credit_reports").upsert(
      parsedReports.map((r) => ({
        report_date: r.date,
        score: r.score,
        reasons: r.reasons,
        negatives: r.negatives ?? [],
        summary: r.summary,
        inquiries: r.inquiries ?? [],
        accounts: r.accounts ?? [],
        synced_at: now,
      })),
      { onConflict: "report_date" },
    );
    if (error) note(problems, "the credit reports", error.message);
    else reports = parsedReports.length;
  }

  return { scores, snapshots, reports };
}
