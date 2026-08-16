import { createHash } from "node:crypto";

// ── What Jamie earned vs what he took, month by month ────────────────────────
// The gym dashboard already works this out — it has the pay model (hourly PT,
// per class, per showed lead, commission, a management rate for hours in the
// gym, and a share of profit above a baseline) and it knows what came out of
// the business. This reads that answer rather than recreating it: two copies of
// a pay calculation is two answers to "what does he owe", and the one on his
// own page had better not be the one that's wrong.
//
// Nothing is stored. The figures are read at page load and shown, so there's no
// table to create and no copy to go stale — if the gym dashboard is unreachable
// the section simply doesn't appear.
//
// Required env vars (add in Vercel → jamie-money → Settings → Environment):
//   GYM_DASHBOARD_URL      the dashboard's base URL
//   GYM_DASHBOARD_API_KEY  its MONEYAPP_API_KEY value — the same shared key the
//                          other cross-app endpoints there use

// The first 8 hex characters of the key's SHA-256. Enough to tell two values
// apart at a glance, and it gives nothing away about the key: the same command
// run against the gym dashboard's value produces the same 8 characters if — and
// only if — the two are identical.
function fingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

export type PayMonth = {
  month: string; // YYYY-MM-01
  label: string; // "March 2026"
  isCurrentMonth: boolean;
  earned: number;
  took: number;
  // Positive = took more than earned, so Chris funded the difference.
  difference: number;
  earnedParts: {
    pt: number;
    classes: number;
    showedLeads: number;
    commission: number;
    management: number;
    profitShare: number;
  };
  tookFrom: { name: string; amount: number; transactions?: EarnLine[] }[];
  // The individual sessions, classes and leads behind the earnings. Null when
  // the gym dashboard is too old to send them.
  earnedDetails: EarnedDetails | null;
};

// One row behind an earnings line — a session, a class, a lead.
export type EarnLine = {
  date: string | null;
  label: string;
  meta: string | null;
  amount: number;
};

export type EarnedDetails = {
  pt: EarnLine[];
  classes: EarnLine[];
  showedLeads: EarnLine[];
  commission: EarnLine[];
  management: EarnLine[];
};

function gymUrl(): string | undefined {
  return process.env.GYM_DASHBOARD_URL;
}

// A key pasted into a hosting dashboard often arrives with a trailing space or
// newline. A space is a legal header character, so it gets sent and the far end
// simply doesn't match it — an invisible character reads back as "wrong key".
// A control character is worse: fetch() throws outright.
//
// Same guard Money App uses for its own calls into the gym dashboard.
function headerSafe(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || /[^\t\x20-\x7e]/.test(v)) return null;
  return v;
}

// The scheme + host of whatever was pasted in, with any path, query or trailing
// slash dropped. A bare "gym-dashboard-v2.vercel.app" is accepted too — leaving
// off https:// is the other easy way to get this wrong.
function originOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function gymPayReady(): boolean {
  return Boolean(gymUrl() && process.env.GYM_DASHBOARD_API_KEY);
}

// An empty result and a broken connection look identical on the page — the
// card just isn't there. That's the right behaviour for Jamie, who shouldn't
// see plumbing, but it left Chris with a blank space and no way to tell a
// missing setting from a wrong key. So the reason comes back too, and the page
// shows it to Chris only.
export type PayMonthsResult = { months: PayMonth[]; problem: string | null };

// How long a good answer is reused for, and how long we'll wait for one.
const GYM_CACHE_SECONDS = 300; // 5 minutes
const GYM_TIMEOUT_MS = 8000;

export async function getPayMonths(months = 24): Promise<PayMonthsResult> {
  const baseUrl = gymUrl();
  const apiKey = headerSafe(process.env.GYM_DASHBOARD_API_KEY);
  if (!baseUrl || !apiKey) {
    const missing = [
      !baseUrl && "GYM_DASHBOARD_URL",
      !apiKey && "GYM_DASHBOARD_API_KEY",
    ].filter(Boolean);
    return {
      months: [],
      problem: `Not connected to the gym dashboard — ${missing.join(" and ")} ${
        missing.length > 1 ? "are" : "is"
      } missing in Vercel. (Adding it needs a redeploy to take effect.)`,
    };
  }

  // Only the origin matters. A URL copied out of the browser usually has a
  // path on it ("…vercel.app/manager"), and gluing the endpoint onto the end of
  // that asks for "/manager/api/payroll/…" — a 404 that looks exactly like a
  // missing deploy, because the host in the error is still right.
  const origin = originOf(baseUrl);
  if (!origin) {
    return {
      months: [],
      problem: `GYM_DASHBOARD_URL doesn't look like a web address: "${baseUrl}". It should be like https://gym-dashboard-v2.vercel.app`,
    };
  }
  const url = `${origin}/api/payroll/jamie-monthly?months=${months}&details=1`;
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      // This is the slowest thing on the Debt page by a distance: another app's
      // serverless function, cold half the time, working out two years of pay
      // down to the individual session. Two guards on it —
      //
      // `revalidate` keeps the answer for a few minutes, so opening Debt twice
      // in a row (or Jamie tapping back and forth) only pays for it once. Pay
      // figures move when the gym dashboard's own data does, which is nothing
      // like every few minutes.
      //
      // `signal` stops a gym dashboard that never answers from holding the page
      // open until Vercel kills the whole request. Past the timeout we show the
      // page without the business half rather than not showing the page.
      next: { revalidate: GYM_CACHE_SECONDS },
      signal: AbortSignal.timeout(GYM_TIMEOUT_MS),
    });
    // The gym dashboard tells these two apart: 503 means it has no key of its
    // own set, so it rejects everything no matter what's sent; 401 means the
    // key sent doesn't match the one it has. Different fixes, different ends.
    if (res.status === 503) {
      const body = await res.json().catch(() => null);
      return {
        months: [],
        problem:
          body?.detail ??
          "The gym dashboard has no MONEYAPP_API_KEY set, so it rejects every key. Set one there and use the same value here.",
      };
    }
    if (res.status === 401) {
      // Both ends fingerprint their key the same way, so the mismatch can be
      // read off the screen instead of guessed at. Same fingerprints with a
      // 401 still means the gym dashboard is running an older build — the
      // value it holds only changes when it redeploys.
      const body = await res.json().catch(() => null);
      const mine = `${apiKey.length} chars, ${fingerprint(apiKey)}`;
      const theirs =
        body?.expectedFingerprint && body?.expectedLength
          ? `${body.expectedLength} chars, ${body.expectedFingerprint}`
          : null;

      if (!theirs) {
        return {
          months: [],
          problem: `The gym dashboard rejected this key (${mine}). Its own deploy may predate the version that reports which key it expects — redeploy the gym dashboard and look again.`,
        };
      }
      return {
        months: [],
        problem:
          theirs === mine
            ? `Both ends hold the same key (${mine}) and it's still being rejected — so the gym dashboard is serving an older build. Redeploy it and make sure the new deployment becomes the live one.`
            : `The keys don't match. This app sends ${mine}; the gym dashboard expects ${theirs}. Paste the same value into both, then redeploy both.`,
      };
    }
    if (res.status === 404) {
      // The whole address, not just the host — the host is usually right and
      // the path is what's wrong, so naming only the host hides the answer.
      return {
        months: [],
        problem: `Nothing at ${url.split("?")[0]} — either that isn't the gym dashboard's address, or its latest deploy hasn't gone out yet.`,
      };
    }
    if (!res.ok) {
      return {
        months: [],
        problem: `The gym dashboard returned ${res.status}.`,
      };
    }

    const body = await res.json();
    if (!body?.configured) {
      return {
        months: [],
        problem:
          "The gym dashboard has no pay model set up for Jamie yet — set his coach in /admin/staff/pay-rates over there.",
      };
    }
    if (!Array.isArray(body.months)) {
      return { months: [], problem: "The gym dashboard sent something unexpected." };
    }

    // Newest first, and months with nothing on either side are dropped — a run
    // of empty rows before he started is noise, not information.
    const rows = (body.months as PayMonth[])
      .filter((m) => m.earned !== 0 || m.took !== 0)
      .sort((a, b) => b.month.localeCompare(a.month));

    return {
      months: rows,
      problem:
        rows.length === 0
          ? "Connected fine, but every month came back with nothing earned and nothing taken."
          : null,
    };
  } catch (err) {
    // The gym dashboard being down — or just slow — must not take the Debt page
    // with it. A timeout says so in those words: "TimeoutError" on the screen
    // reads like this app broke, when the truth is the other one didn't answer.
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      months: [],
      problem: timedOut
        ? `The gym dashboard didn't answer within ${
            GYM_TIMEOUT_MS / 1000
          } seconds, so the page loaded without the business half. Open it again in a moment.`
        : `Couldn't reach the gym dashboard — ${
            err instanceof Error ? err.message : "no answer"
          }.`,
    };
  }
}

// How many months of gym-dashboard history to pull for a Business Finances
// "all-time" request. The gym is under two years old as of this writing —
// this comfortably covers that with room to grow before it needs raising,
// and getPayMonths is a single cached call either way, so asking for more
// than one period needs costs nothing extra.
const ALL_TIME_PAY_MONTHS = 36;

/**
 * Jamie's earned pay (the pay MODEL's figure, not what she actually drew)
 * for one Business Finances period — a year, a single month within it, or
 * all-time. Null whenever the gym dashboard can't answer; the caller treats
 * that as "not available" rather than showing a false $0.
 */
export async function getJamiePayMonths(): Promise<PayMonthsResult> {
  return getPayMonths(ALL_TIME_PAY_MONTHS);
}

/**
 * Jamie's earned pay across one Business Finances period. Pure — the fetch
 * is `getJamiePayMonths` above, so a caller can run it alongside Money App
 * and narrow the answer once BOTH have landed.
 *
 * `year` must be the year MONEY APP resolved to (`data.year`), not the raw
 * `?year=` off the URL. They differ on the commonest load of all: no query
 * string at all, where the URL says nothing and Money App quietly picks the
 * current year. Filtering on the raw param there matched no month, summed
 * to $0, and left the toggle looking broken — it subtracted nothing while
 * still reading as switched on.
 */
export function earnedPayForPeriod(
  result: PayMonthsResult,
  year: number | "all-time",
  month?: number,
): number | null {
  if (result.problem) return null;

  const inPeriod = (m: PayMonth): boolean => {
    // getPayMonths never reaches back before the gym existed, so every month
    // it returns is inside "all time" by construction.
    if (year === "all-time") return true;
    const [y, mm] = m.month.split("-").map(Number);
    return month ? y === year && mm === month : y === year;
  };

  return result.months.filter(inPeriod).reduce((sum, m) => sum + m.earned, 0);
}
