import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { isLoggedIn } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /story → Money App's settlement story.
//
// The story is one document and it lives in Money App. Rebuilding it here kept
// drifting — different preview lines, missing sections, a chapter understated
// by $2,500 — so this hands the reader over instead.
//
// Jamie has no Money App account, so this mints a short-lived pass with the
// shared key. Money App swaps it for a cookie at its door and it grants that
// one page: not a session, not the rest of Money App.
//
// The pass is minted per click and lives about a second in the address bar, so
// it isn't something to bookmark or share — which is the point.
const PASS_TTL_SECONDS = 60 * 60 * 12;

export async function GET() {
  // Same gate as every page here. The story is not public.
  if (!(await isLoggedIn())) {
    return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:3000"));
  }

  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return new NextResponse("Money App isn't connected yet.", { status: 503 });
  }

  // Money App verifies this with the same key and the same recipe.
  const expiry = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
  const signature = createHmac("sha256", apiKey)
    .update(`story:${expiry}`)
    .digest("hex");

  const url = new URL("/divorce/story/enter", baseUrl.replace(/\/$/, ""));
  url.searchParams.set("pass", `${expiry}.${signature}`);
  return NextResponse.redirect(url);
}
