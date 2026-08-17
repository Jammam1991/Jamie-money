import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { linkRecipients, linkUrl } from "@/lib/loginLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bills-reminder → email Jamie to pay and log his bills.
//
// A Vercel cron (see vercel.json) hits this on the 1st and 15th of the
// month. It reuses the same login-link machinery as "Get Jamie in" on
// Settings — see src/lib/loginLink.ts — so the email works whether or not
// he's still signed in, and drops him straight on /bills instead of home.
// Needs the same env vars as that button: GMAIL_USER, GMAIL_APP_PASSWORD,
// ADMIN_PASSWORD, JAMIE_PASSWORD, and JAMIE_EMAIL (or REMINDER_TO as a
// fallback).
//
// If CRON_SECRET is set in Vercel, only requests carrying it are allowed —
// Vercel Cron sends it automatically as `Authorization: Bearer <secret>`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const url = linkUrl(Date.now(), "/bills");
  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "Reminders aren't set up yet — add ADMIN_PASSWORD and JAMIE_PASSWORD in Vercel.",
      },
      { status: 503 },
    );
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = linkRecipients();
  if (!user || !pass || to.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "Reminders aren't set up yet — add GMAIL_USER, GMAIL_APP_PASSWORD, and JAMIE_EMAIL in Vercel.",
      },
      { status: 503 },
    );
  }

  const isFirstHalf = new Date().getUTCDate() < 8;
  const subject = isFirstHalf ? "Bills are due — pay & log 🧾" : "Mid-month bill check-in 🧾";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"Jamie's Money" <${user}>`,
      to,
      subject,
      // Plain text keeps carrier SMS gateways happy (they choke on HTML).
      text:
        "Hi Jamie! Time to pay this round of bills and mark them as paid " +
        "in the app.\n\n" +
        `${url}\n\n` +
        "The link signs you in and takes you straight to the Bills page.",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Couldn't send.";
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: to.length });
}
