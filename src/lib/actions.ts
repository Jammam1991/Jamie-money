"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import {
  client,
  getBillDocuments,
  getBillPayments,
  recordLogin,
} from "./store";
import { AUTH_COOKIE, adminToken, viewerToken, isAdmin, isLoggedIn } from "./auth";
import type { BillDocument, BillPayment, CashKind } from "./data";

export type ActionResult = {
  ok: boolean;
  error?: string;
  id?: string; // real DB id of a just-inserted row (add actions)
  ids?: string[]; // real DB ids of just-inserted rows (bulk import), in input order
};

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

// The cash log is the one place Jamie himself writes, so it only needs a
// login (either password), not the admin one.
async function guardLoggedIn(): Promise<ActionResult | null> {
  return (await isLoggedIn()) ? null : NOT_ALLOWED;
}

// ── Login / logout ────────────────────────────────────────────────────────────
export async function login(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const pw = String(formData.get("password") ?? "");
  const adminPw = process.env.ADMIN_PASSWORD;
  const jamiePw = process.env.JAMIE_PASSWORD;

  const same = (a: string, b: string) =>
    Buffer.from(a).length === Buffer.from(b).length &&
    Buffer.from(a).equals(Buffer.from(b));

  let token: string | null = null;
  let role: "admin" | "viewer" | null = null;
  if (adminPw && same(pw, adminPw)) {
    role = "admin";
    token = adminToken();
  } else if (jamiePw && same(pw, jamiePw)) {
    role = "viewer";
    token = viewerToken();
  }

  if (!token || !role) {
    if (!adminPw && !jamiePw) {
      return {
        ok: false,
        error:
          "No passwords set up yet. Add ADMIN_PASSWORD and JAMIE_PASSWORD in Vercel.",
      };
    }
    return { ok: false, error: "Wrong password." };
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Record Jamie's visit so Chris can see the login log.
  if (role === "viewer") await recordLogin();

  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/");
}

const VIEW_AS_COOKIE = "jm_view_as";

export async function toggleViewAsJamie(): Promise<void> {
  const admin = await isAdmin();
  if (!admin) return;

  const store = await cookies();
  const current = store.get(VIEW_AS_COOKIE)?.value;

  if (current === "jamie") {
    store.delete(VIEW_AS_COOKIE);
  } else {
    store.set(VIEW_AS_COOKIE, "jamie", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });
  }

  revalidatePath("/");
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
  fico: boolean;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("bills")
    .insert({
      name: input.name,
      amount: input.amount,
      due_day: input.dueDay,
      fico: input.fico,
      sort: nextSort(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true, id: data?.id ? String(data.id) : undefined };
}

export async function updateBill(input: {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  fico: boolean;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c
    .from("bills")
    .update({
      name: input.name,
      amount: input.amount,
      due_day: input.dueDay,
      fico: input.fico,
    })
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
  // Deleting a bill cascades to its payments/documents rows, but Postgres
  // can't reach into Storage — clean up the actual files first.
  const { data: docs } = await c
    .from("bill_documents")
    .select("storage_path")
    .eq("bill_id", id);
  if (docs && docs.length > 0) {
    await c.storage
      .from("bill-documents")
      .remove(docs.map((d) => d.storage_path));
  }
  const { error } = await c.from("bills").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

// ── Bill payments & documents ────────────────────────────────────────────────
export async function getBillDetail(billId: string): Promise<
  ActionResult & { payments?: BillPayment[]; documents?: BillDocument[] }
> {
  const [payments, documents] = await Promise.all([
    getBillPayments(billId),
    getBillDocuments(billId),
  ]);
  return { ok: true, payments, documents };
}

// Marking a bill paid is open to Jamie as well as Chris — either of them
// might be the one who actually paid it, so this only needs a login.
export async function addBillPayment(input: {
  billId: string;
  amount: number;
  paidDate: string;
  note?: string;
}): Promise<ActionResult> {
  const denied = await guardLoggedIn();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("bill_payments")
    .insert({
      bill_id: input.billId,
      amount: input.amount,
      paid_date: input.paidDate,
      note: input.note || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true, id: data?.id ? String(data.id) : undefined };
}

export async function updateBillPayment(input: {
  id: string;
  amount: number;
  paidDate: string;
  note?: string;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c
    .from("bill_payments")
    .update({
      amount: input.amount,
      paid_date: input.paidDate,
      note: input.note || null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

export async function deleteBillPayment(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("bill_payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

// One-tap "unmark paid" for Jamie or Chris: remove the newest payment logged
// this month for a bill, so the big checkmark flips back to "Not yet".
export async function unmarkBillPaid(billId: string): Promise<ActionResult> {
  const denied = await guardLoggedIn();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: row } = await c
    .from("bill_payments")
    .select("id")
    .eq("bill_id", billId)
    .gte("paid_date", monthStart)
    .order("paid_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: true };
  const { error } = await c.from("bill_payments").delete().eq("id", row.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bills");
  return { ok: true };
}

// Takes FormData (rather than a plain object) because it carries a File.
export async function uploadBillDocument(formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const billId = String(formData.get("billId") ?? "");
  const file = formData.get("file");
  if (!billId || !(file instanceof File)) {
    return { ok: false, error: "Missing file or bill." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF files are supported." };
  }

  const path = `${billId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await c.storage
    .from("bill-documents")
    .upload(path, file, { contentType: "application/pdf" });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error } = await c
    .from("bill_documents")
    .insert({ bill_id: billId, file_name: file.name, storage_path: path })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bills");
  return { ok: true, id: data?.id ? String(data.id) : undefined };
}

export async function deleteBillDocument(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const { data: row } = await c
    .from("bill_documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.storage_path) {
    await c.storage.from("bill-documents").remove([row.storage_path]);
  }
  const { error } = await c.from("bill_documents").delete().eq("id", id);
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
  const { data, error } = await c
    .from("debts")
    .insert({
      name: input.name,
      balance: input.balance,
      monthly: input.minPayment,
      min_payment: input.minPayment,
      apr: input.apr,
      paid_pct: 0,
      sort: nextSort(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true, id: data?.id ? String(data.id) : undefined };
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
  const { data, error } = await c
    .from("debts")
    .insert(
      rows.map((r, i) => ({
        name: r.name,
        balance: r.balance,
        monthly: r.minPayment,
        min_payment: r.minPayment,
        apr: r.apr,
        paid_pct: 0,
        sort: base + i,
      }))
    )
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  // Postgres returns inserted rows in input order — line them up with the
  // client's optimistic rows so their temp ids can be swapped for real ones.
  return { ok: true, ids: (data ?? []).map((d) => String(d.id)) };
}

// ── Cash log (the simple home screen) ─────────────────────────────────────────
// Jamie taps a big button, picks an amount, and one of these rows is written.
export async function addCashEntry(input: {
  kind: CashKind;
  amount: number;
  happenedOn?: string; // ISO date; defaults to today
}): Promise<ActionResult> {
  const denied = await guardLoggedIn();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  if (!(input.amount > 0)) return { ok: false, error: "Pick an amount first." };
  const happenedOn = /^\d{4}-\d{2}-\d{2}$/.test(input.happenedOn ?? "")
    ? input.happenedOn!
    : new Date().toISOString().split("T")[0];
  const { data, error } = await c
    .from("cash_log")
    .insert({
      kind: input.kind,
      amount: input.amount,
      happened_on: happenedOn,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, id: data?.id ? String(data.id) : undefined };
}

// Undo for a mis-tap (Jamie) or cleanup (Chris).
export async function deleteCashEntry(id: string): Promise<ActionResult> {
  const denied = await guardLoggedIn();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("cash_log").delete().eq("id", id);
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

// ── Owes Chris ────────────────────────────────────────────────────────────────
export async function addOwesCharge(input: {
  description: string;
  amount: number;
  date: string;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("owes_charges")
    .insert({
      description: input.description,
      amount: input.amount,
      date: input.date,
      paid: false,
      sort: nextSort(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/owes");
  return { ok: true, id: data?.id ? String(data.id) : undefined };
}

export async function updateOwesCharge(input: {
  id: string;
  description: string;
  amount: number;
  date: string;
  paid: boolean;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c
    .from("owes_charges")
    .update({
      description: input.description,
      amount: input.amount,
      date: input.date,
      paid: input.paid,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/owes");
  return { ok: true };
}

export async function deleteOwesCharge(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("owes_charges").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/owes");
  return { ok: true };
}

// ── Overall Debt Management ───────────────────────────────────────────────────

export async function addOverallDebt(input: {
  name: string;
  balance: number;
  secured_by: "Chris" | "Jamie" | "Joint";
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("overall_debts")
    .insert({
      name: input.name,
      balance: input.balance,
      secured_by: input.secured_by,
      monthly_payment: "TBD",
      monthly_interest: "TBD",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true, id: data.id };
}

export async function updateOverallDebt(input: {
  id: string;
  name?: string;
  balance?: number;
  secured_by?: "Chris" | "Jamie" | "Joint";
  monthly_payment?: string;
  monthly_interest?: string;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name;
  if (input.balance !== undefined) update.balance = input.balance;
  if (input.secured_by !== undefined) update.secured_by = input.secured_by;
  if (input.monthly_payment !== undefined) update.monthly_payment = input.monthly_payment;
  if (input.monthly_interest !== undefined) update.monthly_interest = input.monthly_interest;
  const { error } = await c.from("overall_debts").update(update).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true };
}

export async function deleteOverallDebt(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("overall_debts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true };
}

// ── Overall Assets Management ─────────────────────────────────────────────────

export async function addOverallAsset(input: {
  name: string;
  value: number;
  owner: "Chris" | "Jamie" | "Joint";
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("overall_assets")
    .insert({
      name: input.name,
      value: input.value,
      owner: input.owner,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true, id: data.id };
}

export async function updateOverallAsset(input: {
  id: string;
  name?: string;
  value?: number;
  owner?: "Chris" | "Jamie" | "Joint";
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name;
  if (input.value !== undefined) update.value = input.value;
  if (input.owner !== undefined) update.owner = input.owner;
  const { error } = await c.from("overall_assets").update(update).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true };
}

export async function deleteOverallAsset(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("overall_assets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true };
}

// ── Overall Context Management ────────────────────────────────────────────────

export async function updateOverallContext(input: {
  jamie_salary?: number;
  jamie_salary_note?: string;
  chris_salary?: number;
  chris_salary_note?: string;
  marriage_start_date?: string;
  marriage_end_date?: string;
  separated_date?: string;
  condo_note?: string;
  legal_plan_note?: string;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.jamie_salary !== undefined) update.jamie_salary = input.jamie_salary;
  if (input.jamie_salary_note !== undefined) update.jamie_salary_note = input.jamie_salary_note;
  if (input.chris_salary !== undefined) update.chris_salary = input.chris_salary;
  if (input.chris_salary_note !== undefined) update.chris_salary_note = input.chris_salary_note;
  if (input.marriage_start_date !== undefined) update.marriage_start_date = input.marriage_start_date;
  if (input.marriage_end_date !== undefined) update.marriage_end_date = input.marriage_end_date;
  if (input.separated_date !== undefined) update.separated_date = input.separated_date;
  if (input.condo_note !== undefined) update.condo_note = input.condo_note;
  if (input.legal_plan_note !== undefined) update.legal_plan_note = input.legal_plan_note;
  const { error } = await c.from("overall_context").update(update).eq("id", "1");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true };
}

// ── Credit reports & score history ───────────────────────────────────────────

// Save one uploaded credit report: the report row, its accounts, and — if the
// report showed a score — a matching entry in the score history.
export async function saveCreditReport(input: {
  reportDate: string;
  bureau: string;
  score: number | null;
  note?: string;
  accounts: { name: string; balance: number; apr: number; minPayment: number }[];
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)
    ? input.reportDate
    : new Date().toISOString().split("T")[0];
  const score =
    input.score !== null && input.score >= 300 && input.score <= 850
      ? Math.round(input.score)
      : null;
  const total = input.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  const { data: report, error } = await c
    .from("credit_reports")
    .insert({
      report_date: reportDate,
      bureau: input.bureau || "Unknown",
      fico_score: score,
      total_balance: total,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const reportId = String(report.id);

  if (input.accounts.length > 0) {
    const { error: accountError } = await c
      .from("credit_report_accounts")
      .insert(
        input.accounts.map((a, i) => ({
          report_id: reportId,
          name: a.name,
          balance: a.balance,
          apr: a.apr,
          min_payment: a.minPayment,
          sort: i,
        }))
      );
    // A half-saved report is worse than none — roll the whole thing back.
    if (accountError) {
      await c.from("credit_reports").delete().eq("id", reportId);
      return { ok: false, error: accountError.message };
    }
  }

  if (score !== null) {
    await c.from("fico_scores").insert({
      score,
      scored_on: reportDate,
      source: "report",
      report_id: reportId,
    });
  }

  revalidatePath("/credit-report");
  return { ok: true, id: reportId };
}

export async function deleteCreditReport(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  // Accounts and the report's score entry are removed by the cascade.
  const { error } = await c.from("credit_reports").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/credit-report");
  return { ok: true };
}

// A score typed in by hand, for the months between full reports.
export async function addFicoScore(input: {
  score: number;
  scoredOn: string;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  if (!(input.score >= 300 && input.score <= 850)) {
    return { ok: false, error: "A credit score is between 300 and 850." };
  }
  const scoredOn = /^\d{4}-\d{2}-\d{2}$/.test(input.scoredOn)
    ? input.scoredOn
    : new Date().toISOString().split("T")[0];
  const { data, error } = await c
    .from("fico_scores")
    .insert({
      score: Math.round(input.score),
      scored_on: scoredOn,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/credit-report");
  return { ok: true, id: String(data.id) };
}

export async function deleteFicoScore(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("fico_scores").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/credit-report");
  return { ok: true };
}

// ── Overall Debt Payments ─────────────────────────────────────────────────────

export async function addOverallDebtPayment(input: {
  payment_date: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const loggedIn = await guardLoggedIn();
  if (loggedIn) return loggedIn;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("overall_debt_payments")
    .insert({
      payment_date: input.payment_date,
      amount: input.amount,
      note: input.note ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true, id: data.id };
}

export async function deleteOverallDebtPayment(id: string): Promise<ActionResult> {
  const loggedIn = await guardLoggedIn();
  if (loggedIn) return loggedIn;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("overall_debt_payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/overall-debt");
  return { ok: true };
}

// ── Debt Transactions ─────────────────────────────────────────────────────────
// The individual charges behind the debt, shown as year -> month -> transaction.

export async function addDebtTransaction(input: {
  tx_date: string;
  description: string;
  amount: number;
  source?: string;
}): Promise<ActionResult> {
  const loggedIn = await guardLoggedIn();
  if (loggedIn) return loggedIn;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("debt_transactions")
    .insert({
      tx_date: input.tx_date,
      description: input.description,
      amount: input.amount,
      source: input.source ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true, id: data.id };
}

export async function deleteDebtTransaction(id: string): Promise<ActionResult> {
  const loggedIn = await guardLoggedIn();
  if (loggedIn) return loggedIn;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("debt_transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true };
}
