import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  bills as sampleBills,
  debts as sampleDebts,
  divorce as sampleDivorce,
  summary as sampleSummary,
  weeklyIncome as sampleIncome,
  type Bill,
  type Debt,
  type Divorce,
  type Summary,
  type Txn,
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

// The Home page's headline numbers. Falls back to the sample until Chris
// saves real ones (or, later, the bank feed fills them in).
export async function getSummary(): Promise<Summary> {
  const c = client();
  if (!c) return sampleSummary;
  const { data, error } = await c
    .from("home_summary")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) return sampleSummary;
  return {
    statusLabel: data.status_label || sampleSummary.statusLabel,
    statusNote: data.status_note ?? "",
    netWorth: Number(data.net_worth),
    netWorthChange: Number(data.net_worth_change),
    moneyIn: Number(data.money_in),
    moneyOut: Number(data.money_out),
    recent: Array.isArray(data.recent) ? (data.recent as Txn[]) : [],
  };
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
  }));
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
