import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reminder → send Jamie his Sunday "log your week" nudge.
//
// A weekly Vercel cron (see vercel.json) hits this every Sunday. It emails
// every address in REMINDER_TO — a normal email, a carrier text gateway
// (e.g. 5551234567@vtext.com for Verizon), or both, comma-separated — via
// Gmail using an app password:
//   GMAIL_USER          the Gmail address that sends the reminder
//   GMAIL_APP_PASSWORD  a Google "app password" (not the real password)
//   REMINDER_TO         who gets it, comma-separated
//   APP_URL             optional, the site link in the message
//
// If CRON_SECRET is set in Vercel, only requests carrying it are allowed —
// Vercel Cron sends it automatically as `Authorization: Bearer <secret>`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = (process.env.REMINDER_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!user || !pass || to.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "Reminders aren't set up yet — add GMAIL_USER, GMAIL_APP_PASSWORD, and REMINDER_TO in Vercel.",
      },
      { status: 503 },
    );
  }

  const appUrl = process.env.APP_URL || "https://jamie-money.vercel.app";
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"Jamie's Money" <${user}>`,
      to,
      subject: "It's Sunday — log your week 💆",
      // Plain text keeps carrier SMS gateways happy (they choke on HTML).
      text:
        "Hi Jamie! The week is ending — open your app and make sure every " +
        "massage and every bit of cash from this week is logged.\n\n" +
        appUrl,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Couldn't send.";
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: to.length });
}
