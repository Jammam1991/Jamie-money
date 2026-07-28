import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { client } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/keepalive → touch the database so Supabase doesn't pause it.
//
// Supabase pauses free projects after ~7 days with no activity, which takes the
// whole site down until someone unpauses it by hand. A daily Vercel cron hits
// this route (see vercel.json) and runs one tiny read, which counts as
// activity and resets the clock.
//
// If CRON_SECRET is set in Vercel, only requests carrying it are allowed —
// Vercel Cron sends it automatically as `Authorization: Bearer <secret>`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const c = client();
  if (!c) {
    return NextResponse.json(
      { ok: false, reason: "The database isn't connected yet." },
      { status: 503 },
    );
  }

  // Cheapest possible query: ask how many rows are in `debts` without pulling
  // any of them back.
  const { error } = await c
    .from("debts")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
