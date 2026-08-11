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
  const apiKey = process.env.GYM_DASHBOARD_API_KEY;
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

  const url = `${baseUrl.replace(/\/$/, "")}/api/payroll/jamie-monthly?months=${months}`;
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (res.status === 401) {
      return {
        months: [],
        problem:
          "The gym dashboard rejected the key. GYM_DASHBOARD_API_KEY has to be the same value as MONEYAPP_API_KEY over there.",
      };
    }
    if (res.status === 404) {
      return {
        months: [],
        problem: `No pay endpoint at ${new URL(url).host}. Either that isn't the gym dashboard's address, or its latest deploy hasn't gone out yet.`,
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
