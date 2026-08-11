import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { client } from "@/lib/store";
import { moneyAppReady, syncMoneyAppDebts } from "@/lib/moneyapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/moneyapp/cron → pull Jamie's debts + credit score from Money App on
// a schedule.
//
// A nightly Vercel cron hits this (see vercel.json). The Debt page pulls on its
// own too, but only when someone opens it — this is what keeps the numbers
// current for the pages that read the same rows without opening Debt (Home,
// Overall Debt, Credit Report).
//
// Unlike the page-load pull, this one is not throttled: it runs once a night by
// definition, and skipping it because someone happened to open the Debt page an
// hour earlier would mean the nightly refresh silently stops happening.
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
