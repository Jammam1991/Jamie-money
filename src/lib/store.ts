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

// Returns a Supabase client only if the keys are configured (in Vercel).
// Until then, everything gracefully falls back to the sample content so the
// live site keeps working.
//
// We accept whichever standard names Supabase's Vercel integration provides.
// For the server key we prefer the new-style secret key (`sb_secret_…`, added
// automatically by the integration) and fall back to a classic service-role
// key. Both have full database access; anon/publishable keys are never used
// here because row-level security would block writes.
export function client(): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
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

// ── Overall Debt & Assets ────────────────────────────────────────────────────

export interface OverallDebt {
  id: string;
  name: string;
  balance: number;
  securedBy: "Chris" | "Jamie" | "Joint";
  monthlyPayment: string;
  monthlyInterest: string;
}

export async function getOverallDebts(): Promise<OverallDebt[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("overall_debts")
    .select("*")
    .order("sort");
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: row.name,
    balance: Number(row.balance),
    securedBy: row.secured_by as "Chris" | "Jamie" | "Joint",
    monthlyPayment: row.monthly_payment,
    monthlyInterest: row.monthly_interest,
  }));
}

export interface OverallAsset {
  id: string;
  name: string;
  value: number;
  owner: "Chris" | "Jamie" | "Joint";
}

export async function getOverallAssets(): Promise<OverallAsset[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("overall_assets")
    .select("*")
    .order("sort");
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: row.name,
    value: Number(row.value),
    owner: row.owner as "Chris" | "Jamie" | "Joint",
  }));
}

export interface OverallContext {
  jamieSalary: number;
  jamieSalaryNote: string;
  chrisSalary: number;
  chrisSalaryNote: string;
  marriageStartDate: string;
  marriageEndDate: string;
  separatedDate: string;
  condoNote: string;
  legalPlanNote: string;
}

export async function getOverallContext(): Promise<OverallContext> {
  const c = client();
  if (!c) {
    return {
      jamieSalary: 147000,
      jamieSalaryNote: "cash deposits",
      chrisSalary: 135000,
      chrisSalaryNote: "rental deposits & W-2 income",
      marriageStartDate: "July 2020",
      marriageEndDate: "present",
      separatedDate: "2023",
      condoNote: "Separate property — purchased before marriage",
      legalPlanNote: "Metlife Legal plan covers uncontested divorce",
    };
  }
  const { data, error } = await c
    .from("overall_context")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return {
      jamieSalary: 147000,
      jamieSalaryNote: "cash deposits",
      chrisSalary: 135000,
      chrisSalaryNote: "rental deposits & W-2 income",
      marriageStartDate: "July 2020",
      marriageEndDate: "present",
      separatedDate: "2023",
      condoNote: "Separate property — purchased before marriage",
      legalPlanNote: "Metlife Legal plan covers uncontested divorce",
    };
  }
  return {
    jamieSalary: Number(data.jamie_salary),
    jamieSalaryNote: data.jamie_salary_note,
    chrisSalary: Number(data.chris_salary),
    chrisSalaryNote: data.chris_salary_note,
    marriageStartDate: data.marriage_start_date,
    marriageEndDate: data.marriage_end_date,
    separatedDate: data.separated_date,
    condoNote: data.condo_note,
    legalPlanNote: data.legal_plan_note,
  };
}

export interface OverallDebtPayment {
  id: string;
  paymentDate: string;
  amount: number;
  note?: string;
}

export async function getOverallDebtPayments(): Promise<OverallDebtPayment[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("overall_debt_payments")
    .select("*")
    .order("payment_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    paymentDate: row.payment_date,
    amount: Number(row.amount),
    note: row.note ?? undefined,
  }));
}
