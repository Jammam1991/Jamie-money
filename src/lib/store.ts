import { createClient } from "@supabase/supabase-js";
import {
  debts as sampleDebts,
  divorce as sampleDivorce,
  bills as sampleBills,
  type Debt,
  type Divorce,
  type Bill,
} from "./data";

// Returns a Supabase client only if the keys are configured (in Vercel).
// Until then, everything gracefully falls back to the sample content so the
// live site keeps working.
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  }));
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
    frequency: row.frequency,
    dueDate: row.due_date,
  }));
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
    keyDates: Array.isArray(data.key_dates) ? data.key_dates : [],
    documentsCount: Number(data.documents_count),
  };
}
