"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { client } from "./store";
import { ADMIN_COOKIE, adminToken, isAdmin } from "./auth";

export type ActionResult = { ok: boolean; error?: string };

const NOT_CONNECTED: ActionResult = {
  ok: false,
  error: "Not saved — the online database isn't connected yet.",
};

const NOT_ALLOWED: ActionResult = {
  ok: false,
  error: "Not saved — please log in first.",
};

// Every write goes through this so a logged-out visitor (or a direct POST)
// can never change Jamie's data.
async function guard(): Promise<ActionResult | null> {
  return (await isAdmin()) ? null : NOT_ALLOWED;
}

// ── Login / logout ────────────────────────────────────────────────────────────
export async function login(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const pw = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return {
      ok: false,
      error: "No password is set up yet. Add ADMIN_PASSWORD in Vercel.",
    };
  }
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  const match = a.length === b.length && a.equals(b);
  if (!match) return { ok: false, error: "Wrong password." };

  const store = await cookies();
  store.set(ADMIN_COOKIE, adminToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/");
}

// A sort value that keeps newly added rows in the order they were created.
// Seconds fit inside Postgres' integer column; milliseconds would overflow.
function nextSort(): number {
  return Math.floor(Date.now() / 1000);
}

// ── Bills ─────────────────────────────────────────────────────────────────────
export async function setWeeklyIncome(value: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c
    .from("settings")
    .upsert({ key: "weekly_income", value: String(value) }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

export async function addBill(input: {
  name: string;
  amount: number;
  dueDay: number;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("bills").insert({
    name: input.name,
    amount: input.amount,
    due_day: input.dueDay,
    sort: nextSort(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

export async function updateBill(input: {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c
    .from("bills")
    .update({ name: input.name, amount: input.amount, due_day: input.dueDay })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

export async function deleteBill(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("bills").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

// ── Debts ─────────────────────────────────────────────────────────────────────
export async function addDebt(input: {
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("debts").insert({
    name: input.name,
    balance: input.balance,
    monthly: input.minPayment,
    min_payment: input.minPayment,
    apr: input.apr,
    paid_pct: 0,
    sort: nextSort(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true };
}

export async function updateDebt(input: {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c
    .from("debts")
    .update({
      name: input.name,
      balance: input.balance,
      apr: input.apr,
      monthly: input.minPayment,
      min_payment: input.minPayment,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("debts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true };
}

// Bulk-add debts read from an uploaded credit report.
export async function importDebts(
  rows: { name: string; balance: number; apr: number; minPayment: number }[]
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  if (rows.length === 0) return { ok: false, error: "Nothing to import." };
  const base = nextSort();
  const { error } = await c.from("debts").insert(
    rows.map((r, i) => ({
      name: r.name,
      balance: r.balance,
      monthly: r.minPayment,
      min_payment: r.minPayment,
      apr: r.apr,
      paid_pct: 0,
      sort: base + i,
    }))
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true };
}

// ── Home summary ──────────────────────────────────────────────────────────────
export async function updateSummary(input: {
  statusLabel: string;
  statusNote: string;
  netWorth: number;
  netWorthChange: number;
  moneyIn: number;
  moneyOut: number;
  recent: { id: string; name: string; kind: string; amount: number }[];
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const row = {
    status_label: input.statusLabel,
    status_note: input.statusNote,
    net_worth: input.netWorth,
    net_worth_change: input.netWorthChange,
    money_in: input.moneyIn,
    money_out: input.moneyOut,
    recent: input.recent,
    updated_at: new Date().toISOString(),
  };

  // Home numbers live in a single row: update it if present, else add it.
  const { data: existing } = await c
    .from("home_summary")
    .select("id")
    .limit(1)
    .maybeSingle();
  const { error } = existing
    ? await c.from("home_summary").update(row).eq("id", existing.id)
    : await c.from("home_summary").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// ── Divorce ───────────────────────────────────────────────────────────────────
export async function updateDivorce(input: {
  supportAmount: number;
  supportNextDate: string;
  supportPaidThisMonth: boolean;
  documentsCount: number;
  split: { item: string; note: string }[];
  benefits: string[];
  keyDates: { label: string; date: string }[];
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const row = {
    support_amount: input.supportAmount,
    support_next_date: input.supportNextDate,
    support_paid_this_month: input.supportPaidThisMonth,
    documents_count: input.documentsCount,
    split: input.split,
    benefits: input.benefits,
    key_dates: input.keyDates,
    updated_at: new Date().toISOString(),
  };

  // The divorce details live in a single row; update it if present, else add it.
  const { data: existing } = await c
    .from("divorce_details")
    .select("id")
    .limit(1)
    .maybeSingle();
  const { error } = existing
    ? await c.from("divorce_details").update(row).eq("id", existing.id)
    : await c.from("divorce_details").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/divorce");
  return { ok: true };
}
