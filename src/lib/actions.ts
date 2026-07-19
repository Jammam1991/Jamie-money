"use server";

import { revalidatePath } from "next/cache";
import { client } from "./store";

export type ActionResult = { ok: boolean; error?: string };

const NOT_CONNECTED: ActionResult = {
  ok: false,
  error: "Not saved — the online database isn't connected yet.",
};

// A sort value that keeps newly added rows in the order they were created.
// Seconds fit inside Postgres' integer column; milliseconds would overflow.
function nextSort(): number {
  return Math.floor(Date.now() / 1000);
}

// ── Bills ─────────────────────────────────────────────────────────────────────
export async function setWeeklyIncome(value: number): Promise<ActionResult> {
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
