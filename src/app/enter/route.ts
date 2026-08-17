import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, loginLinkValid, viewerToken } from "@/lib/auth";
import { recordLogin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where a good link lands Jamie. `to` is untrusted input, so only a plain
// in-app path is allowed — anything else (a full URL, a protocol-relative
// "//evil.com") falls back to home instead of becoming an open redirect.
function landingPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

// GET /enter?k=…&to=… → the other end of a link Chris or a reminder email
// sent Jamie. `to` picks the page he lands on (e.g. /bills) — omit it and he
// lands on home, same as before.
//
// A good key swaps itself for the ordinary 30-day login cookie, so from here
// on Jamie is signed in exactly as if he'd typed the password. A bad or
// stale one drops him on the login page with a note, not an error screen —
// the most likely reason to land here is a link that sat unread too long.
//
// The cookie is set on the redirect itself rather than through `cookies()`,
// because a Route Handler's own response is the only thing certain to carry
// the Set-Cookie header out with the redirect.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("k") ?? "";
  const token = viewerToken();

  if (!key || !token || !loginLinkValid(key, Date.now())) {
    return NextResponse.redirect(new URL("/login?link=expired", request.url));
  }

  const to = landingPath(request.nextUrl.searchParams.get("to"));
  const response = NextResponse.redirect(new URL(to, request.url));
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days, same as typing the password
  });

  // Chris watches the login log to see how often Jamie checks in — a visit
  // that started from a link still counts as a visit.
  await recordLogin();

  return response;
}
