import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { client } from "@/lib/store";
import { moneyAppReady, syncMoneyAppDebts } from "@/lib/moneyapp";

export const runtime = "nodejs";

// POST /api/moneyapp/sync → pull Jamie's debts + credit score from Money App
// (the "Sync from Money App" button on the Debt page).
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }
  if (!moneyAppReady()) {
    return NextResponse.json({ error: "Money App isn't connected yet." }, { status: 503 });
  }
  const c = client();
  if (!c) {
    return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  }

  const result = await syncMoneyAppDebts(c);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, synced: result.synced, fico: result.fico });
}
