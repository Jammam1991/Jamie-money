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

/** What the reader sees when the handover doesn't work. */
function cantOpen(reason: string, detail: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Can't open the story</title>` +
      `<div style="font:16px/1.5 system-ui,-apple-system,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.5rem;color:#111">` +
      `<h1 style="font-size:1.25rem;margin:0 0 .75rem">Can't open the story right now</h1>` +
      `<p style="margin:0 0 1rem">${reason}</p>` +
      `<p style="margin:0;color:#666;font-size:.875rem">${detail}</p>` +
      `</div>`,
    { status: 502, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const here = new URL(request.url).origin;

  // Same gate as every page here. The story is not public.
  if (!(await isLoggedIn())) {
    return NextResponse.redirect(new URL("/login", here));
  }

  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return cantOpen(
      "This app isn't connected to Money App yet.",
      "Add MONEYAPP_API_URL and MONEYAPP_API_KEY in Vercel, then redeploy.",
    );
  }

  const origin = baseUrl.replace(/\/$/, "");
  let pass: string;
  try {
    const res = await fetch(`${origin}/api/divorce/story/pass`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      return cantOpen(
        "Money App wouldn't issue a pass to the story.",
        `It answered ${res.status} when this app asked for one. If that's 401, the API key here no longer matches the one Money App has.`,
      );
    }
    const body = await res.json();
    pass = body?.pass;
    if (!pass) {
      return cantOpen(
        "Money App wouldn't issue a pass to the story.",
        "It answered without one, which usually means no signing secret is set on that side.",
      );
    }
  } catch {
    return cantOpen(
      "Couldn't reach Money App.",
      `Nothing answered at ${origin}.`,
    );
  }

  const door = new URL("/divorce/story/enter", origin);
  door.searchParams.set("pass", pass);

  // Knock before sending the reader through.
  //
  // A pass that Money App declines used to land Jamie on Money App's sign-in
  // page — a dead end that looks like his fault and says nothing about what
  // actually went wrong. The pass is a signature plus an expiry, not a ticket
  // that gets torn, so checking it costs one fast request and spends nothing.
  //
  // A door that opens answers with a redirect to the story itself. Anything
  // else — sign-in, an error, a hop somewhere unexpected — is reported here
  // instead of being handed to the reader as a login screen.
  try {
    const knock = await fetch(door, { redirect: "manual", cache: "no-store" });
    const landsOn = knock.headers.get("location") ?? "";
    if (!landsOn.includes("/divorce/story")) {
      return cantOpen(
        "Money App turned the pass down.",
        landsOn.includes("/login")
          ? "It sent this app to its sign-in page instead of the story, which means the pass didn't verify — the two sides are signing with different secrets."
          : `It answered ${knock.status}${landsOn ? ` and pointed at ${landsOn}` : " with nowhere to go"}.`,
      );
    }
  } catch {
    // The knock is a diagnostic, not a gate. If it can't be made, hand over
    // anyway rather than withholding a story that may well open fine.
  }

  return NextResponse.redirect(door);
}
