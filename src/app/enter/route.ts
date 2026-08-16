import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, loginLinkValid, viewerToken } from "@/lib/auth";
import { recordLogin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /enter?k=… → the other end of the link Chris sends Jamie.
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

  const response = NextResponse.redirect(new URL("/", request.url));
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
