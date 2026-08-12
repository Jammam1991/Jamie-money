import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /story-frame — Money App's story page, served from this origin.
//
// The Debt Story used to be redrawn here from Money App's exported data, and
// the two drifted every time that page changed. Now the iframe on the Debt
// Story page points here, and this hands back Money App's own page.
//
// The API key stays server-side: an iframe can't send headers, so the browser
// asks this route (same origin, no credential) and this route asks Money App
// (with the key). Nothing secret reaches the page.
export async function GET() {
  // Same gate as every other page — the story is not public.
  if (!(await isLoggedIn())) {
    return new NextResponse("Please log in first.", { status: 401 });
  }

  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return new NextResponse("Money App isn't connected yet.", { status: 503 });
  }

  const origin = baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${origin}/divorce/story/embed`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      return new NextResponse(`Money App returned ${res.status}.`, {
        status: 502,
      });
    }

    const html = await res.text();

    // Every stylesheet, script and image in that HTML is a path like
    // "/_next/static/…", which would resolve against THIS origin and 404. A
    // <base> tag points them all back at Money App in one line, rather than
    // rewriting URLs and missing one.
    const withBase = html.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${origin}/">`,
    );

    return new NextResponse(withBase, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // It's framed by this app and nothing else.
        "content-security-policy": "frame-ancestors 'self'",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Couldn't reach Money App.", { status: 502 });
  }
}
