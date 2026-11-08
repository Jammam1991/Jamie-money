// ── What Jamie owns, typed in by hand ────────────────────────────────────────
// The Assets card on Financial Picture. Chris, 2026-11-08: "Assets — Jewlery,
// IRA (Future), Real Estate, Stocks, Life Insurance?". None of these has a feed
// to read from, so each is a number Jamie (or Admin) types in, kept as one JSON
// row in `settings`. The IRA isn't here: it's the money Chris's 401k deal moves
// into Jamie's IRA, read from that plan so the two pages can't disagree.

export const ASSETS_KEY = "assets";

export type AssetKey = "jewelry" | "realEstate" | "stocks" | "lifeInsurance";

export type Assets = Record<AssetKey, number | null>;

export const ASSET_ROWS: { key: AssetKey; emoji: string; label: string; hint: string }[] = [
  { key: "jewelry", emoji: "⌚", label: "Jewelry", hint: "Watch, rings — what it would sell for" },
  { key: "realEstate", emoji: "🏠", label: "Real estate", hint: "What you'd get if you sold, minus the mortgage" },
  { key: "stocks", emoji: "📈", label: "Stocks", hint: "Brokerage or stock app balance" },
  { key: "lifeInsurance", emoji: "🛡️", label: "Life insurance", hint: "Cash value, if the policy has one" },
];

// Before anything is typed: the Rolex the Debt page already counts at $25,000.
export const DEFAULT_ASSETS: Assets = { jewelry: 25000, realEstate: null, stocks: null, lifeInsurance: null };

export function parseAssets(raw: unknown): Assets {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_ASSETS };
  for (const { key } of ASSET_ROWS) {
    if (!(key in src)) continue;
    const v = src[key];
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
    out[key] = v === null || v === "" ? null : Number.isFinite(n) && n >= 0 ? Math.round(n) : out[key];
  }
  return out;
}
