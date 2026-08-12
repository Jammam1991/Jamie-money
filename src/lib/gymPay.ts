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
  tookFrom: { name: string; amount: number }[];
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
  const url = `${origin}/api/payroll/jamie-monthly?months=${months}`;
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
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
      // Two rounds of "copy the value across" haven't fixed it, so name the
      // key this app is actually sending — its length and a fingerprint. Both
      // are safe: the note is admin-only, and a SHA-256 prefix reveals nothing
      // about the key itself. Chris can fingerprint the gym dashboard's value
      // the same way and see in one glance whether they differ, instead of
      // squinting at two long strings.
      return {
        months: [],
        problem:
          `The gym dashboard has a key set, and this one doesn't match it. This app is sending a ${apiKey.length}-character key, fingerprint ${fingerprint(apiKey)}. ` +
          `Run: echo -n 'THE_GYM_VALUE' | shasum -a 256 — if the first 8 characters differ, the two values aren't the same. Also check you edited the same environment (Production vs Preview) as the deployment you're looking at.`,
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
    // The gym dashboard being down must not take the Debt page with it.
    return {
      months: [],
      problem: `Couldn't reach the gym dashboard — ${
        err instanceof Error ? err.message : "no answer"
      }.`,
    };
  }
}
