"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import {
  client,
  getBillDocuments,
  getBillPayments,
  getComingSoonPages,
  recordLogin,
  HOUSEHOLD_INCOME_KEY,
  SETTLEMENT_TOTAL_KEY,
  type HouseholdIncome,
  type SettlementTerms,
} from "./store";
import { AUTH_COOKIE, adminToken, viewerToken, isAdmin, isLoggedIn } from "./auth";
import type { BillDocument, BillPayment, CashKind } from "./data";
import { findCleanupCandidates, type CleanupCandidate } from "./duplicateDebts";
import { clearIgnoredMoneyAppDebts, ignoreMoneyAppDebt } from "./moneyapp";

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

// ── Which pages say "Coming Soon" to Jamie ────────────────────────────────────
// Stored as one JSON list of page keys under the `hidden_pages` setting.
export async function setPageComingSoon(
  key: string,
  comingSoon: boolean
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const next = new Set(await getComingSoonPages());
  if (comingSoon) next.add(key);
  else next.delete(key);

  const { error } = await c
    .from("settings")
    .upsert(
      { key: "hidden_pages", value: JSON.stringify([...next]) },
      { onConflict: "key" }
    );
  if (error) return { ok: false, error: error.message };
  // The nav and menu live in the root layout, so refresh every page.
  revalidatePath("/", "layout");
  return { ok: true };
}

// What Jamie owes Chris out of the settlement: the total, the rate and the term.
// The monthly payment is worked out from these on the page rather than stored,
// so it can't drift out of step with them.
//
// All three empty clears the row back to the page's own estimate instead of
// pinning it to zero — different answers, and the wrong one would tell Jamie he
// owes nothing.
export async function setSettlementTerms(
  input: SettlementTerms,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const clean = (v: number | null, round = true) =>
    v === null || !Number.isFinite(v) || v < 0 ? null : round ? Math.round(v) : v;
  const terms: SettlementTerms = {
    total: clean(input.total),
    apr: clean(input.apr, false),
    months: clean(input.months),
  };

  const empty =
    terms.total === null && terms.apr === null && terms.months === null;

  const { error } = empty
    ? await c.from("settings").delete().eq("key", SETTLEMENT_TOTAL_KEY)
    : await c
        .from("settings")
        .upsert(
          { key: SETTLEMENT_TOTAL_KEY, value: JSON.stringify(terms) },
          { onConflict: "key" },
        );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/debt");
  return { ok: true };
}

// Chris's own pay and the rental's rent — the two incomes the Big Picture needs
// and nothing else in the app can reach. Blank clears the figure back to "not
// set", which the page shows as an unknown rather than as zero income.
export async function setHouseholdIncome(
  input: HouseholdIncome,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;

  const clean = (v: number | null) =>
    v === null || !Number.isFinite(v) || v < 0 ? null : Math.round(v);
  const income: HouseholdIncome = {
    chris: clean(input.chris),
    rental: clean(input.rental),
  };

  const { error } =
    income.chris === null && income.rental === null
      ? await c.from("settings").delete().eq("key", HOUSEHOLD_INCOME_KEY)
      : await c
          .from("settings")
          .upsert(
            { key: HOUSEHOLD_INCOME_KEY, value: JSON.stringify(income) },
            { onConflict: "key" },
          );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/big-picture");
  return { ok: true };
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

  // If this row came from Money App, deleting it isn't enough: the next sync
  // pulls the same account straight back in. Money App exports Jamie's scope
  // *and* the joint one, so Chris's own accounts (the TD Bank mortgage) ride
  // along. Remembering the deletion is what makes it stay gone.
  const { data: row } = await c
    .from("debts")
    .select("moneyapp_debt_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await c.from("debts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (row?.moneyapp_debt_id) {
    await ignoreMoneyAppDebt(c, String(row.moneyapp_debt_id));
  }
  revalidatePath("/debt");
  return { ok: true };
}

// Bring back every account that was deleted out of the Money App sync. Without
// this, one mis-click hides a real account of Jamie's for good.
export async function unhideMoneyAppDebts(): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const error = await clearIgnoredMoneyAppDebts(c);
  if (error) return { ok: false, error };
  revalidatePath("/debt");
  return { ok: true };
}

// ── Clearing out the hand-entered rows Money App now covers ──────────────────
// The sync never deletes, so accounts typed in before Money App was connected
// sit alongside the synced copies and the total counts both. These two power
// the "Clean up duplicates" button: one to see what would go, one to remove
// exactly the rows that were ticked.

export async function listCleanupCandidates(): Promise<{
  ok: boolean;
  error?: string;
  candidates?: CleanupCandidate[];
}> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied.error };
  const c = client();
  if (!c) return { ok: false, error: NOT_CONNECTED.error };

  const { data, error } = await c
    .from("debts")
    .select("id, name, balance, min_payment, moneyapp_debt_id");
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    candidates: findCleanupCandidates(
      (data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        balance: Number(row.balance ?? 0),
        minPayment: Number(row.min_payment ?? 0),
        fromMoneyApp: Boolean(row.moneyapp_debt_id),
      })),
    ),
  };
}

// Deletes only the ids handed in, and only ones that aren't Money App's — a
// synced row deleted here would come straight back on the next pull, so the
// button would look broken. Belt and braces: the UI never offers them.
export async function deleteManualDebts(ids: string[]): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (ids.length === 0) return { ok: true };
  const c = client();
  if (!c) return NOT_CONNECTED;

  const { error } = await c
    .from("debts")
    .delete()
    .in("id", ids)
    .is("moneyapp_debt_id", null);
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

// ── Tax documents (Google Drive links) ───────────────────────────────────────
// The one piece of the Tax Center that lives here rather than in the Money
// App — Chris adds the link once he's got a redacted return saved to Drive.
export async function addTaxDocument(input: {
  year: number;
  driveUrl: string;
  label?: string;
}): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const url = input.driveUrl.trim();
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, error: "That doesn't look like a link (needs to start with https://)." };
  }
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { data, error } = await c
    .from("tax_documents")
    .insert({
      tax_year: input.year,
      drive_url: url,
      label: input.label?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/tax-center");
  return { ok: true, id: data.id };
}

export async function deleteTaxDocument(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const c = client();
  if (!c) return NOT_CONNECTED;
  const { error } = await c.from("tax_documents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/tax-center");
  return { ok: true };
}
