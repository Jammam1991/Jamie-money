// Reports the git SHA of the deployment currently serving traffic. The client
// bakes its OWN SHA into its bundle at build time (see next.config.ts); when
// this endpoint reports a different one, a newer deploy is live and the
// client is stale — that's what powers the "update available" banner.
//
// On Vercel every deploy is immutable and the production domain always routes
// to the LATEST deployment, so a stale client polling here gets the fresh SHA
// even though its own static bundle is old. No auth: a git SHA isn't sensitive.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GIT_SHA = process.env.GIT_SHA ?? "local";

export async function GET() {
  return NextResponse.json(
    { sha: GIT_SHA },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
