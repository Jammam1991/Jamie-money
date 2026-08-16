import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { client } from "@/lib/store";
import { moneyAppReady, syncMoneyAppDebts } from "@/lib/moneyapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/moneyapp/cron → pull Jamie's debts + credit score from Money App on
// a schedule.
//
// A nightly Vercel cron hits this (see vercel.json). It is the ONLY pull that
// happens without someone asking for it: opening the Debt page does not sync,
// whatever an earlier version of this comment claimed. The other way in is the
// "Sync from Money App" button (MoneyAppConnect), which is admin-only and sits
// in the Business Debt section and under "Where these numbers come from".
//
// So a gap between Money App and this app closes overnight at the latest —
// worth knowing when a number here disagrees with one over there.
//
// If CRON_SECRET is set in Vercel, only requests carrying it are allowed —
// Vercel Cron sends it automatically as `Authorization: Bearer <secret>`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  if (!moneyAppReady()) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "Money App isn't connected yet — add MONEYAPP_API_URL and MONEYAPP_API_KEY in Vercel.",
      },
      { status: 503 },
    );
  }

  const c = client();
  if (!c) {
    return NextResponse.json(
      { ok: false, reason: "The database isn't connected yet." },
      { status: 503 },
    );
  }

  const result = await syncMoneyAppDebts(c);
  if (result.error) {
    return NextResponse.json({ ok: false, reason: result.error }, { status: 502 });
  }
  return NextResponse.json({
    ok: result.problems.length === 0,
    received: result.received,
    synced: result.synced,
    scores: result.scores,
    snapshots: result.snapshots,
    reports: result.reports,
    loans: result.loans,
    problems: result.problems,
  });
}
