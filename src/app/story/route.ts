import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /story → Money App's settlement story.
//
// The story is one document and it lives in Money App. Rebuilding it here kept
// drifting — different preview lines, missing sections, a chapter understated
// by $2,500 — so this hands the reader over instead.
//
// Jamie has no Money App account, so we ask Money App for a pass using the API
// key, server-side, and send him through its door with it. Money App does the
// signing: it stores API keys hashed, so it can't verify a signature we make
// with one. That was the first attempt, and it sent everyone to a login page.
//
// The key never leaves this server. The pass is minted per click, lasts 12
// hours, and grants that one page.
export async function GET(request: Request) {
  const here = new URL(request.url).origin;

  // Same gate as every page here. The story is not public.
  if (!(await isLoggedIn())) {
    return NextResponse.redirect(new URL("/login", here));
  }

  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return new NextResponse("Money App isn't connected yet.", { status: 503 });
  }

  const origin = baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${origin}/api/divorce/story/pass`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      return new NextResponse(
        `Money App wouldn't issue a pass to the story (${res.status}).`,
        { status: 502 },
      );
    }
    const { pass } = await res.json();
    if (!pass) {
      return new NextResponse("Money App sent no pass.", { status: 502 });
    }

    const url = new URL("/divorce/story/enter", origin);
    url.searchParams.set("pass", pass);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("Couldn't reach Money App.", { status: 502 });
  }
}
