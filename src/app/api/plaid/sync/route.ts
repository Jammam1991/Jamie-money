import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { client } from "@/lib/store";
import { plaidReady } from "@/lib/plaid";
import { syncBankDebts } from "@/lib/plaid-liabilities";

export const runtime = "nodejs";

// POST /api/plaid/sync → re-pull every connected bank's debts (the "Refresh"
// button on the Debt page).
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }
  if (!plaidReady()) {
    return NextResponse.json({ error: "Bank connection isn't set up yet." }, { status: 503 });
  }
  const c = client();
  if (!c) {
    return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  }

  const { data: items, error } = await c.from("plaid_items").select("id, access_token");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, items: 0 });
  }

  let synced = 0;
  let lastError: string | undefined;
  for (const item of items) {
    if (!item.access_token) continue;
    const r = await syncBankDebts(c, item.access_token);
    synced += r.synced;
    if (r.error) lastError = r.error;
    await c
      .from("plaid_items")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", item.id);
  }
  return NextResponse.json({ ok: true, synced, items: items.length, error: lastError });
}
