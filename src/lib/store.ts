import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  bills as sampleBills,
  debts as sampleDebts,
  divorce as sampleDivorce,
  owesChris as sampleOwesChris,
  sampleCashLog,
  samplePayments,
  weeklyIncome as sampleIncome,
  type Bill,
  type BillDocument,
  type BillPayment,
  type CashEntry,
  type CashKind,
  type Debt,
  type Divorce,
  type OwesCharge,
} from "./data";
import { isDebtType, type DebtType, type ReportSnapshot } from "./creditReport";

// Returns a Supabase client only if the keys are configured (in Vercel).
// Until then, everything gracefully falls back to the sample content so the
// live site keeps working.
//
// We accept whichever standard names Supabase's Vercel integration provides.
// For the server key we prefer the new-style secret key (`sb_secret_…`, added
// automatically by the integration) and fall back to a classic service-role
// key. Both have full database access; anon/publishable keys are never used
// here because row-level security would block writes.
// Built once and reused. Every reader below calls this, so a page that asks for
// nine things was building nine clients — and each one sets up its own auth and
// realtime machinery that none of this uses. There's nothing per-visitor in it
// (no session is kept, the key is the same server key every time), so one is
// correct as well as cheaper.
let cachedClient: SupabaseClient | null = null;

export function client(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

// Which Supabase project the app is actually writing to, e.g.
// "abcdefg.supabase.co". Just the host — no keys, nothing secret. Setup SQL run
// in a different project looks exactly like SQL that never ran, and this is the
// one thing that tells those two apart.
export function databaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function getDebts(): Promise<Debt[]> {
  const c = client();
  if (!c) return sampleDebts;
  const { data, error } = await c.from("debts").select("*").order("sort");
  if (error || !data || data.length === 0) return sampleDebts;
  return data.map((row) => ({
    id: String(row.id),
    name: row.name,
    balance: Number(row.balance),
    monthly: Number(row.monthly),
    paidPct: Number(row.paid_pct),
    apr: Number(row.apr ?? 0),
    minPayment: Number(row.min_payment ?? row.monthly ?? 0),
    debtType: row.debt_type ? String(row.debt_type) : undefined,
    scope: row.scope ? String(row.scope) : undefined,
  }));
}

// One charge that helped build the debt, for the year -> month -> transaction
// drill-down on the Debt page.
export interface DebtTransaction {
  id: string;
  txDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
  source?: string; // which card or loan it landed on
}

export async function getDebtTransactions(): Promise<DebtTransaction[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("debt_transactions")
    .select("*")
    .order("tx_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    txDate: row.tx_date,
    description: row.description,
    amount: Number(row.amount),
    source: row.source ?? undefined,
  }));
}

// What Chris spent on Jamie that was never treated as a loan — gifts and the
// like. Same shape as a debt transaction, but deliberately a separate list: it
// is not debt and must never be added to a debt total.
export async function getJamieSpending(): Promise<DebtTransaction[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("jamie_spending")
    .select("*")
    .order("tx_date", { ascending: false });
  // The table arrives with jamie_spending.sql. Until that's run there's simply
  // nothing to show, which is not worth breaking the page over.
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    txDate: row.tx_date,
    description: row.description,
    amount: Number(row.amount),
    source: row.source ?? undefined,
  }));
}

// The Home page's cash log, newest first. An empty list is a legitimate state
// (nothing logged yet) — only fall back to the sample when there's no database.
export async function getCashLog(): Promise<CashEntry[]> {
  const c = client();
  if (!c) return sampleCashLog;
  const { data, error } = await c
    .from("cash_log")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    kind: row.kind as CashKind,
    amount: Number(row.amount),
    happenedOn: row.happened_on,
    note: row.note ?? undefined,
  }));
}

// Has Jamie linked at least one bank for the debts feed?
export async function hasPlaidItems(): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { count } = await c
    .from("plaid_items")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

// Jamie's latest credit score, last pulled from Money App.
// ── What Jamie owes Chris out of the settlement ──────────────────────────────
// Chris sets what's owed, the rate and how long it runs for. The monthly
// payment isn't stored: it's worked out from those three, so the four numbers
// can never disagree with each other on screen.
//
// Every field is null until he sets it, which is what tells "cleared, go back to
// the estimate" apart from "set to zero" — opposite answers for money Jamie is
// told he owes.
//
// It lives in `settings` rather than a column of its own because it isn't a
// debt: there's no lender and nothing syncs it. That also means no setup SQL.
export const SETTLEMENT_TOTAL_KEY = "divorce_settlement_total";

export type SettlementTerms = {
  total: number | null; // what's owed
  apr: number | null; // yearly rate, percent
  months: number | null; // how long it runs for
};

export const NO_SETTLEMENT_TERMS: SettlementTerms = {
  total: null,
  apr: null,
  months: null,
};

function positive(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function getSettlementTerms(): Promise<SettlementTerms> {
  const c = client();
  if (!c) return NO_SETTLEMENT_TERMS;
  const { data, error } = await c
    .from("settings")
    .select("value")
    .eq("key", SETTLEMENT_TOTAL_KEY)
    .maybeSingle();
  if (error || !data?.value) return NO_SETTLEMENT_TERMS;

  // This key used to hold a bare total. Read that shape too, so the figure
  // Chris already saved survives rather than reverting to the estimate.
  const raw = String(data.value);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        total: positive(parsed.total),
        apr: positive(parsed.apr),
        months: positive(parsed.months),
      };
    }
    return { total: positive(parsed), apr: null, months: null };
  } catch {
    return { total: positive(raw), apr: null, months: null };
  }
}

export async function getMoneyAppFico(): Promise<{ score: number; date: string } | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c
    .from("settings")
    .select("value")
    .eq("key", "moneyapp_fico")
    .maybeSingle();
  if (error || !data) return null;
  try {
    const parsed = JSON.parse(data.value);
    if (typeof parsed.score === "number" && typeof parsed.date === "string") {
      return { score: parsed.score, date: parsed.date };
    }
  } catch {
    // ignore malformed value
  }
  return null;
}

// Which pages Chris has parked as "Coming Soon" for Jamie. The link stays put;
// the page just shows a placeholder instead of its content. Kept as one JSON
// list in the existing key/value settings table (no new table to create), under
// the original `hidden_pages` key so earlier choices carry over.
//
// `cache` because the layout asks (to decide the Past Due tab) and then the
// page asks again through pageGate — two round trips to the database for the
// same short list on every single page view. Wrapped, the second one is free,
// and it still re-reads on the next request.
export const getComingSoonPages = cache(async function getComingSoonPages(): Promise<
  string[]
> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("settings")
    .select("value")
    .eq("key", "hidden_pages")
    .maybeSingle();
  if (error || !data) return [];
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
});

export async function getBills(): Promise<Bill[]> {
  const c = client();
  if (!c) return sampleBills;
  const { data, error } = await c.from("bills").select("*").order("sort");
  if (error || !data || data.length === 0) return sampleBills;
  return data.map((row) => ({
    id: String(row.id),
    name: row.name,
    amount: Number(row.amount),
    dueDay: Number(row.due_day ?? 0),
    fico: Boolean(row.fico),
  }));
}

// Which bills already have a payment logged this calendar month? Used to show
// the big "Paid" checkmarks and the "left to pay" headline on the Bills page.
export async function getPaidBillIdsThisMonth(): Promise<string[]> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const c = client();
  if (!c) {
    return Object.keys(samplePayments).filter((billId) =>
      samplePayments[billId].some((p) => p.paidDate >= monthStart)
    );
  }
  const { data, error } = await c
    .from("bill_payments")
    .select("bill_id")
    .gte("paid_date", monthStart);
  if (error || !data) return [];
  return [...new Set(data.map((row) => String(row.bill_id)))];
}

// Bills that were NOT paid last month (and existed back then). After the 1st,
// these roll over into the Bills page as "left over from last month" and get
// added to the amount still owed.
export async function getRolloverBillIds(): Promise<string[]> {
  const c = client();
  if (!c) return [];
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const firstOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  // Date() handles the January → December year wrap for us.
  const prevStart = firstOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const monthStart = firstOf(new Date(now.getFullYear(), now.getMonth(), 1));

  // Don't invent debt for months before payment tracking started: if the
  // earliest payment ever recorded is within the current month (or there are
  // none at all), last month wasn't being tracked yet — no rollover.
  const { data: earliest } = await c
    .from("bill_payments")
    .select("paid_date")
    .order("paid_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!earliest || earliest.paid_date >= monthStart) return [];

  const [{ data: pays }, { data: bills }] = await Promise.all([
    c
      .from("bill_payments")
      .select("bill_id")
      .gte("paid_date", prevStart)
      .lt("paid_date", monthStart),
    c.from("bills").select("id, created_at").lt("created_at", monthStart),
  ]);
  const paid = new Set((pays ?? []).map((p) => String(p.bill_id)));
  return (bills ?? [])
    .map((b) => String(b.id))
    .filter((id) => !paid.has(id));
}

// The manual payment log for one bill. Unlike getBills, an empty result here
// is a legitimate state (no payments logged yet) — only fall back to sample
// data when the app isn't connected to a database at all.
export async function getBillPayments(billId: string): Promise<BillPayment[]> {
  const c = client();
  if (!c) return samplePayments[billId] ?? [];
  const { data, error } = await c
    .from("bill_payments")
    .select("*")
    .eq("bill_id", billId)
    .order("paid_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    billId: String(row.bill_id),
    amount: Number(row.amount),
    paidDate: row.paid_date,
    note: row.note ?? undefined,
  }));
}

// The lease/agreement documents attached to one bill, each with a short-lived
// signed download link generated on the fly (the bucket is private).
export async function getBillDocuments(billId: string): Promise<BillDocument[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("bill_documents")
    .select("*")
    .eq("bill_id", billId)
    .order("uploaded_at", { ascending: false });
  if (error || !data) return [];
  return Promise.all(
    data.map(async (row) => {
      const { data: signed } = await c.storage
        .from("bill-documents")
        .createSignedUrl(row.storage_path, 3600);
      return {
        id: String(row.id),
        billId: String(row.bill_id),
        fileName: row.file_name,
        uploadedAt: row.uploaded_at,
        url: signed?.signedUrl ?? null,
      };
    })
  );
}

// Jamie's weekly massage income, stored as a single named setting.
export async function getWeeklyIncome(): Promise<number> {
  const c = client();
  if (!c) return sampleIncome;
  const { data, error } = await c
    .from("settings")
    .select("value")
    .eq("key", "weekly_income")
    .maybeSingle();
  if (error || !data) return sampleIncome;
  const n = Number(data.value);
  return Number.isFinite(n) ? n : sampleIncome;
}

export async function getDivorce(): Promise<Divorce> {
  const c = client();
  if (!c) return sampleDivorce;
  const { data, error } = await c
    .from("divorce_details")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) return sampleDivorce;
  return {
    support: {
      amount: Number(data.support_amount),
      nextDate: data.support_next_date ?? "",
      paidThisMonth: Boolean(data.support_paid_this_month),
    },
    split: Array.isArray(data.split) ? data.split : [],
    benefits: Array.isArray(data.benefits) ? data.benefits : [],
    keyDates: Array.isArray(data.key_dates) ? data.key_dates : [],
    documentsCount: Number(data.documents_count),
  };
}

// ── Jamie's login log ─────────────────────────────────────────────────────────
// Record one row each time Jamie logs in, and read back the count + recent times
// for the admin-only Activity screen.
export async function recordLogin(): Promise<void> {
  const c = client();
  if (!c) return;
  await c.from("logins").insert({ at: new Date().toISOString() });
}

export type LoginLog = { count: number; recent: string[] };

export async function getLogins(): Promise<LoginLog> {
  const c = client();
  if (!c) return { count: 0, recent: [] };
  const { count } = await c
    .from("logins")
    .select("*", { count: "exact", head: true });
  const { data } = await c
    .from("logins")
    .select("at")
    .order("at", { ascending: false })
    .limit(15);
  return { count: count ?? 0, recent: (data ?? []).map((r) => String(r.at)) };
}

export async function getOwesCharges(): Promise<OwesCharge[]> {
  const c = client();
  if (!c) return sampleOwesChris;
  const { data, error } = await c
    .from("owes_charges")
    .select("*")
    .order("date", { ascending: false });
  if (error || !data || data.length === 0) return sampleOwesChris;
  return data.map((row) => ({
    id: String(row.id),
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    paid: Boolean(row.paid),
  }));
}

// ── Job vs Business ──────────────────────────────────────────────────────────
export interface JobVsBusiness {
  id: string;
  businessMonthlyIncome: number;
  jobSalaryAnnual: number;
  benefitsValue: number;
  businessHoursPerWeek: number;
  jobHoursPerWeek: number;
}

export async function getJobVsBusiness(): Promise<JobVsBusiness | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c
    .from("job_vs_business")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    businessMonthlyIncome: Number(data.business_monthly_income),
    jobSalaryAnnual: Number(data.job_salary_annual),
    benefitsValue: Number(data.benefits_value),
    businessHoursPerWeek: Number(data.business_hours_per_week),
    jobHoursPerWeek: Number(data.job_hours_per_week),
  };
}

export interface ProCon {
  id: string;
  type: "business_pro" | "business_con" | "job_pro" | "job_con";
  text: string;
  sort: number;
}

export async function getProsCons(): Promise<ProCon[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("business_pros_cons")
    .select("*")
    .order("sort");
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    type: row.type as ProCon["type"],
    text: row.text,
    sort: Number(row.sort),
  }));
}

export interface JobPosting {
  id: string;
  companyName: string;
  roleTitle: string;
  salary: string | null;
  link: string | null;
  status: "Interested" | "Applied" | "Interview" | "Offer" | "Rejected";
  notes: string | null;
  createdAt: string;
}

export async function getJobPostings(): Promise<JobPosting[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("job_postings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    companyName: row.company_name,
    roleTitle: row.role_title,
    salary: row.salary,
    link: row.link,
    status: row.status as JobPosting["status"],
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export interface DecisionEntry {
  id: string;
  entryDate: string;
  notes: string;
  createdAt: string;
}

export async function getDecisionJournal(): Promise<DecisionEntry[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("decision_journal")
    .select("*")
    .order("entry_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    entryDate: row.entry_date,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

// ── Credit history, mirrored from Money App ──────────────────────────────────
// Money App owns the credit-report parsing and the score log. These tables are
// a read-only copy refreshed by syncMoneyAppDebts — nothing here is edited in
// this app.

export interface NegativeFactor {
  name: string;
  kind?: string;
  status?: string;
  balance?: number;
  pastDue?: number;
}

export interface FicoScoreEntry {
  score: number;
  scoredOn: string;
  note: string | null;
  negatives?: NegativeFactor[] | null;
}

// The credit-score history, oldest first so the chart reads left to right.
export async function getFicoHistory(): Promise<FicoScoreEntry[]> {
  const c = client();
  if (!c) return [];

  // Fetch both fico history and credit reports
  const [ficoRes, reportsRes] = await Promise.all([
    c
      .from("moneyapp_fico_history")
      .select("*")
      .order("scored_on", { ascending: true }),
    c
      .from("moneyapp_credit_reports")
      .select("report_date, negatives")
      .order("report_date", { ascending: true }),
  ]);

  if (ficoRes.error || !ficoRes.data) return [];

  // Build a map of report_date -> negatives for quick lookup
  const negativesByDate = new Map<string, NegativeFactor[]>();
  if (!reportsRes.error && reportsRes.data) {
    for (const report of reportsRes.data) {
      if (report.negatives && Array.isArray(report.negatives)) {
        negativesByDate.set(report.report_date, report.negatives as NegativeFactor[]);
      }
    }
  }

  return ficoRes.data.map((row) => ({
    score: Number(row.score),
    scoredOn: row.scored_on,
    note: row.note ?? null,
    negatives: negativesByDate.get(row.scored_on) ?? null,
  }));
}

// A credit account with the extra details the Credit Report page shows —
// account type, when it opened, which day it reports, and any note. All of it
// comes from Money App; a debt entered by hand here simply has none of it.
export interface CreditAccount extends Debt {
  // How the payment history and the report snapshots find this account.
  moneyappDebtId: string | null;
  type: DebtType;
  openedDate: string | null;
  creditReportDay: number | null;
  notes: string | null;
}

export async function getCreditAccounts(): Promise<CreditAccount[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.from("debts").select("*").order("sort");
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: row.name,
    balance: Number(row.balance),
    monthly: Number(row.monthly),
    paidPct: Number(row.paid_pct),
    apr: Number(row.apr ?? 0),
    minPayment: Number(row.min_payment ?? row.monthly ?? 0),
    moneyappDebtId: row.moneyapp_debt_id ? String(row.moneyapp_debt_id) : null,
    type: isDebtType(row.debt_type) ? row.debt_type : "other",
    openedDate: row.opened_date ?? null,
    creditReportDay: row.credit_report_day != null ? Number(row.credit_report_day) : null,
    notes: row.notes ?? null,
  }));
}

// Every report Money App has parsed, newest first.
export async function getCreditReports(): Promise<ReportSnapshot[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("moneyapp_credit_reports")
    .select("*")
    .order("report_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    date: row.report_date,
    score: row.score != null ? Number(row.score) : null,
    reasons: (row.reasons as ReportSnapshot["reasons"]) ?? null,
    negatives: (row.negatives as ReportSnapshot["negatives"]) ?? [],
    summary: (row.summary as ReportSnapshot["summary"]) ?? null,
    inquiries: (row.inquiries as ReportSnapshot["inquiries"]) ?? [],
    reportAccounts: (row.accounts as ReportSnapshot["reportAccounts"]) ?? [],
  }));
}

// The raw per-account balance rows, for the payment-history squares on each
// account. getCreditSnapshots() groups the same rows by report date instead.
export interface DebtSnapshotRow {
  moneyappDebtId: string;
  date: string;
  balance: number;
  missedPayment: boolean;
  note: string | null;
}

export async function getDebtSnapshotRows(): Promise<DebtSnapshotRow[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("moneyapp_debt_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    moneyappDebtId: String(row.moneyapp_debt_id),
    date: row.snapshot_date,
    balance: Number(row.balance),
    missedPayment: Boolean(row.missed_payment),
    note: row.note ?? null,
  }));
}
