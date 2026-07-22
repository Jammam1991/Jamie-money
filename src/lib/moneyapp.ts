import type { SupabaseClient } from "@supabase/supabase-js";

// ── Money App debt + credit-score feed ────────────────────────────────────────
// Pulls Jamie's real debt balances and latest credit score from the separate
// Money App project via its API, and writes the debts into our own `debts`
// table (keyed by moneyapp_debt_id, so a re-sync updates in place instead of
// piling up duplicates). The credit score has no natural home of its own, so
// it's stashed in `settings` under the key "moneyapp_fico".
//
// Required env vars (add in Vercel → jamie-money → Settings → Environment):
//   MONEYAPP_API_URL — Money App's base URL, e.g. https://moneyapp.example.com
//   MONEYAPP_API_KEY — an API key generated in the Money App repo via
//                       `node scripts/generate-api-key.mjs "jamie-money integration"`
//
// Until both are set, moneyAppReady() is false and the app quietly skips this
// feature (manual entry and the bank feed still work).

export type MoneyAppFico = { score: number; date: string };
export type MoneyAppSyncResult = {
  synced: number;
  fico: MoneyAppFico | null;
  error?: string;
};

type ExportDebt = {
  id: string;
  name: string;
  type: string;
  balance: number;
  apr: number;
  minPayment: number;
};
type ExportResponse = { debts: ExportDebt[]; fico: MoneyAppFico | null };

export function moneyAppReady(): boolean {
  return Boolean(process.env.MONEYAPP_API_URL && process.env.MONEYAPP_API_KEY);
}

export async function syncMoneyAppDebts(
  supabase: SupabaseClient,
): Promise<MoneyAppSyncResult> {
  const baseUrl = process.env.MONEYAPP_API_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return { synced: 0, fico: null, error: "Money App isn't connected yet." };
  }

  let parsed: ExportResponse;
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/debt/export?person=jamie`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Money App returned ${res.status}`);
    parsed = await res.json();
  } catch (err) {
    return {
      synced: 0,
      fico: null,
      error: err instanceof Error ? err.message : "Couldn't reach Money App.",
    };
  }

  // Which of these accounts already have a row? Keep it, update in place.
  const ids = parsed.debts.map((d) => d.id);
  const { data: existing } = ids.length
    ? await supabase
        .from("debts")
        .select("id, moneyapp_debt_id")
        .in("moneyapp_debt_id", ids)
    : { data: [] as { id: string; moneyapp_debt_id: string }[] };
  const existingMap = new Map(
    (existing ?? []).map((r) => [r.moneyapp_debt_id as string, r.id as string]),
  );

  const base = Math.floor(Date.now() / 1000);
  let synced = 0;
  for (let i = 0; i < parsed.debts.length; i++) {
    const d = parsed.debts[i];
    const existingId = existingMap.get(d.id);
    if (existingId) {
      await supabase
        .from("debts")
        .update({
          name: d.name,
          balance: d.balance,
          apr: d.apr,
          min_payment: d.minPayment,
          monthly: d.minPayment,
        })
        .eq("id", existingId);
    } else {
      await supabase.from("debts").insert({
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        min_payment: d.minPayment,
        monthly: d.minPayment,
        paid_pct: 0,
        source: "moneyapp",
        moneyapp_debt_id: d.id,
        sort: base + i,
      });
    }
    synced++;
  }

  if (parsed.fico) {
    await supabase.from("settings").upsert({
      key: "moneyapp_fico",
      value: JSON.stringify(parsed.fico),
      updated_at: new Date().toISOString(),
    });
  }

  return { synced, fico: parsed.fico ?? null };
}
