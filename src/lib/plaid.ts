import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

// ── Plaid server client ───────────────────────────────────────────────────────
// Talks to Jamie's OWN Plaid account. Keys live in Vercel env vars, never in
// the code. Until they're set, `plaidReady()` is false and the app quietly
// skips every bank-feed feature (the manual "Add a debt" path still works).
//
// Required env vars (add in Vercel → jamie-money → Settings → Environment):
//   PLAID_CLIENT_ID   — from Jamie's Plaid dashboard
//   PLAID_SECRET      — the secret for the environment below
//   PLAID_ENV         — "sandbox" | "development" | "production" (default sandbox)

type PlaidEnvName = "sandbox" | "development" | "production";

function resolveEnv(): PlaidEnvName {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (raw === "sandbox" || raw === "development" || raw === "production") return raw;
  return "sandbox";
}

export function plaidReady(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

let cached: PlaidApi | null = null;

export function plaidClient(): PlaidApi {
  if (cached) return cached;
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error(
      "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in Vercel.",
    );
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[resolveEnv()],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
        "Plaid-Version": "2020-09-14",
      },
    },
  });
  cached = new PlaidApi(config);
  return cached;
}

// Jamie's Debt page only needs the "debts" feed (balances, APR, minimums).
export const PLAID_PRODUCTS: Products[] = [Products.Liabilities];
export const PLAID_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];
