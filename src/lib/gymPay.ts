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

export async function getPayMonths(months = 24): Promise<PayMonth[]> {
  const baseUrl = gymUrl();
  const apiKey = process.env.GYM_DASHBOARD_API_KEY;
  if (!baseUrl || !apiKey) return [];

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/payroll/jamie-monthly?months=${months}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const body = await res.json();
    if (!body?.configured || !Array.isArray(body.months)) return [];

    // Newest first, and months with nothing on either side are dropped — a run
    // of empty rows before he started is noise, not information.
    return (body.months as PayMonth[])
      .filter((m) => m.earned !== 0 || m.took !== 0)
      .sort((a, b) => b.month.localeCompare(a.month));
  } catch {
    // The gym dashboard being down must not take the Debt page with it.
    return [];
  }
}
