import type { SupabaseClient } from "@supabase/supabase-js";
import { APRAprTypeEnum } from "plaid";
import { plaidClient } from "./plaid";

// ── Bank "debts" feed ─────────────────────────────────────────────────────────
// Pulls Jamie's credit cards, loans, and mortgages straight from his bank via
// Plaid and writes them into the `debts` table. Each bank account keeps the
// same row across refreshes (keyed by plaid_account_id), so balances update in
// place instead of piling up duplicates.
//
// Plaid's Liabilities product gives full detail (APR + minimum payment) for
// credit cards, student loans, and mortgages. Auto/personal loans usually come
// back as plain "loan" accounts with just a balance — we still add those so the
// number shows up; Jamie (or Chris) can fill the rate/minimum by hand.

export type SyncResult = { synced: number; error?: string };

type DebtRow = {
  plaid_account_id: string;
  name: string;
  balance: number;
  apr: number;
  min_payment: number;
};

// Pull one item's accounts + liabilities and upsert them into `debts`.
export async function syncBankDebts(
  supabase: SupabaseClient,
  accessToken: string,
): Promise<SyncResult> {
  let mapped: DebtRow[];
  try {
    mapped = await fetchBankDebts(accessToken);
  } catch (err) {
    const e = err as { response?: { data?: unknown }; message?: string };
    return { synced: 0, error: JSON.stringify(e.response?.data ?? e.message ?? String(err)) };
  }

  if (mapped.length === 0) return { synced: 0 };

  // Which of these accounts already have a row? Keep it, update in place.
  const ids = mapped.map((m) => m.plaid_account_id);
  const { data: existing } = await supabase
    .from("debts")
    .select("id, plaid_account_id")
    .in("plaid_account_id", ids);
  const existingMap = new Map(
    (existing ?? []).map((r) => [r.plaid_account_id as string, r.id as string]),
  );

  const base = Math.floor(Date.now() / 1000);
  let synced = 0;
  for (let i = 0; i < mapped.length; i++) {
    const d = mapped[i];
    const existingId = existingMap.get(d.plaid_account_id);
    if (existingId) {
      // Balance + name always follow the bank. APR / minimum only overwrite
      // when Plaid actually returned a value (>0) so a hand-typed rate on an
      // auto loan isn't wiped out by a refresh that has no detail for it.
      const patch: Record<string, unknown> = { name: d.name, balance: d.balance };
      if (d.apr > 0) patch.apr = d.apr;
      if (d.min_payment > 0) {
        patch.min_payment = d.min_payment;
        patch.monthly = d.min_payment;
      }
      await supabase.from("debts").update(patch).eq("id", existingId);
    } else {
      await supabase.from("debts").insert({
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        min_payment: d.min_payment,
        monthly: d.min_payment,
        paid_pct: 0,
        source: "plaid",
        plaid_account_id: d.plaid_account_id,
        sort: base + i,
      });
    }
    synced++;
  }
  return { synced };
}

// Ask Plaid for one item's accounts + liability detail and flatten to debt rows.
async function fetchBankDebts(accessToken: string): Promise<DebtRow[]> {
  const resp = await plaidClient().liabilitiesGet({ access_token: accessToken });
  const accounts = resp.data.accounts;
  const liab = resp.data.liabilities;

  // Account lookup for names + balances.
  const acctMap = new Map(accounts.map((a) => [a.account_id, a]));
  const out: DebtRow[] = [];
  const covered = new Set<string>();

  for (const c of liab.credit ?? []) {
    const id = c.account_id ?? "";
    const acct = acctMap.get(id);
    const apr =
      c.aprs?.find((a) => a.apr_type === APRAprTypeEnum.PurchaseApr)?.apr_percentage ??
      c.aprs?.[0]?.apr_percentage ??
      0;
    out.push({
      plaid_account_id: id,
      name: acct?.name ?? acct?.official_name ?? "Credit card",
      balance: Math.abs(acct?.balances.current ?? c.last_statement_balance ?? 0),
      apr: apr ?? 0,
      min_payment: c.minimum_payment_amount ?? 0,
    });
    covered.add(id);
  }

  for (const m of liab.mortgage ?? []) {
    const id = m.account_id ?? "";
    const acct = acctMap.get(id);
    out.push({
      plaid_account_id: id,
      name: acct?.name ?? acct?.official_name ?? "Mortgage",
      balance: Math.abs(acct?.balances.current ?? 0),
      apr: m.interest_rate?.percentage ?? 0,
      min_payment: m.next_monthly_payment ?? 0,
    });
    covered.add(id);
  }

  for (const s of liab.student ?? []) {
    const id = s.account_id ?? "";
    const acct = acctMap.get(id);
    out.push({
      plaid_account_id: id,
      name: acct?.name ?? acct?.official_name ?? "Student loan",
      balance: Math.abs(acct?.balances.current ?? 0),
      apr: s.interest_rate_percentage ?? 0,
      min_payment: s.minimum_payment_amount ?? 0,
    });
    covered.add(id);
  }

  // Any remaining credit-card or loan accounts Plaid didn't detail (auto loans,
  // personal loans): add the balance so it still shows up.
  for (const a of accounts) {
    if (covered.has(a.account_id)) continue;
    if (a.type !== "credit" && a.type !== "loan") continue;
    out.push({
      plaid_account_id: a.account_id,
      name: a.name ?? a.official_name ?? "Loan",
      balance: Math.abs(a.balances.current ?? 0),
      apr: 0,
      min_payment: 0,
    });
  }

  return out;
}
