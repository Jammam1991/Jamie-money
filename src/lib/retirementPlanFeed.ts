// The 401k Plan's starting numbers, from Money App.
//
// Money App works out what Jamie owes, Chris's 401(k), and the deal Chris has
// set, and sends them from /api/divorce/retirement-plan. The math itself runs
// here (src/lib/retirementPlan.ts) so Jamie can change his own savings and see
// it move straight away.
//
// Needs:
//   MONEYAPP_API_URL / MONEYAPP_API_KEY — the same pair the debt sync uses.

import type { PlanBase } from "./retirementPlan";

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

export async function getPlanBase(): Promise<{ base: PlanBase | null; error: string | null }> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) return { base: null, error: "Money App isn't connected yet." };
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/divorce/retirement-plan`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return { base: null, error: `Money App returned ${res.status}.` };
    const body = (await res.json()) as PlanBase;
    if (!body?.settings || !body?.live) return { base: null, error: "Money App sent something unexpected." };
    return { base: body, error: null };
  } catch {
    return { base: null, error: "Couldn't reach Money App." };
  }
}
