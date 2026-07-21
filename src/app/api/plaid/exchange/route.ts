import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { client } from "@/lib/store";
import { plaidClient, plaidReady } from "@/lib/plaid";
import { syncBankDebts } from "@/lib/plaid-liabilities";

export const runtime = "nodejs";

// POST /api/plaid/exchange  { public_token, institution_name? }
// Runs right after Jamie picks his bank: swaps the one-time public_token for a
// lasting access_token, saves the connection, then pulls his debts.
export async function POST(req: Request) {
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

  let body: { public_token?: string; institution_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body.public_token) {
    return NextResponse.json({ error: "Missing bank token." }, { status: 400 });
  }

  try {
    const exchange = await plaidClient().itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const access_token = exchange.data.access_token;
    const item_id = exchange.data.item_id;

    const { error: itemErr } = await c.from("plaid_items").upsert(
      {
        item_id,
        access_token,
        institution_name: body.institution_name ?? null,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );
    if (itemErr) {
      return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }

    const result = await syncBankDebts(c, access_token);
    return NextResponse.json({ ok: true, synced: result.synced, error: result.error });
  } catch (err) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error("[plaid/exchange]", JSON.stringify(e.response?.data ?? e.message ?? String(err)));
    return NextResponse.json({ error: "Couldn't finish connecting the bank." }, { status: 500 });
  }
}
