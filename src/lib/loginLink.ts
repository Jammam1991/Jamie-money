import nodemailer from "nodemailer";
import { LINK_MINUTES, makeLoginLink } from "./auth";

// Emailing Jamie a link that logs him in. The same Gmail account that sends
// the Sunday reminder sends this — see src/app/api/reminder/route.ts:
//   GMAIL_USER          the Gmail address that sends it
//   GMAIL_APP_PASSWORD  a Google "app password", not the real one
//   JAMIE_EMAIL         where the link goes; falls back to REMINDER_TO
//   APP_URL             optional, the site's address

export function appUrl(): string {
  return (process.env.APP_URL || "https://jamie-money.vercel.app").replace(/\/+$/, "");
}

// The Sunday reminder can go to several places at once — Chris's inbox, a
// carrier text gateway, whatever. A login link should only go to Jamie, so
// JAMIE_EMAIL wins when it's set and REMINDER_TO is only the fallback.
export function linkRecipients(): string[] {
  const raw = process.env.JAMIE_EMAIL || process.env.REMINDER_TO || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function linkUrl(now: number): string | null {
  const key = makeLoginLink(now);
  return key ? `${appUrl()}/enter?k=${encodeURIComponent(key)}` : null;
}

export type SendResult = { ok: true; sentTo: string[] } | { ok: false; error: string };

export async function emailLoginLink(now: number): Promise<SendResult> {
  const url = linkUrl(now);
  if (!url) {
    return {
      ok: false,
      error:
        "Passwords aren't set up yet — add ADMIN_PASSWORD and JAMIE_PASSWORD in Vercel, then redeploy.",
    };
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = linkRecipients();
  if (!user || !pass) {
    return {
      ok: false,
      error:
        "Email isn't set up yet — add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy.",
    };
  }
  if (to.length === 0) {
    return { ok: false, error: "No address to send to — add JAMIE_EMAIL in Vercel, then redeploy." };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"Jamie's Money" <${user}>`,
      to,
      subject: "Your way in 🔑",
      // Plain text, like the Sunday reminder — carrier SMS gateways choke on
      // HTML, and this may well be read on a phone.
      text:
        `Hi Jamie! Tap this to open your money app:\n\n${url}\n\n` +
        `The link only works for ${LINK_MINUTES} minutes, so open it now. ` +
        `Once you're in, you'll stay signed in for 30 days.\n\n` +
        `Add it to your home screen and it works like a normal app.`,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't send the email." };
  }

  return { ok: true, sentTo: to };
}
