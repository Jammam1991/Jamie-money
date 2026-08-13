import { client } from "./store";

// ── Tax Center ─────────────────────────────────────────────────────────────
// Year-by-year: what was actually paid in taxes, what came back as a refund,
// and what the refund went toward — read live from Money App's "Filed" tab on
// its Global Tax Center. Nothing is saved here, the same as businessFinances.ts
// — every load asks Money App fresh, so an edit over there shows up on the
// next page load with no sync to remember.
//
// The Google Drive links to the actual return documents are the one thing
// this app stores itself (in `tax_documents`), because Money App has no
// concept of them.
//
// Required env vars (Vercel → jamie-money → Settings → Environment):
//   MONEYAPP_API_URL / MONEYAPP_API_KEY — the same pair the debt sync uses.

export type TaxFilingResult = {
  year: number;
  taxesPaid: number | null;
  refundAmount: number | null;
  refundUsedFor: string | null;
};

export type TaxDocument = {
  id: string;
  taxYear: number;
  driveUrl: string;
  label: string | null;
};

function apiUrl(): string | undefined {
  return process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
}

export function taxCenterReady(): boolean {
  return Boolean(apiUrl() && process.env.MONEYAPP_API_KEY);
}

/**
 * The filed-results table, straight from Money App. Never throws — Money App
 * being down or not yet connected comes back as an empty list with a reason,
 * because a page that says why it's empty beats one that won't load.
 */
export async function getTaxFilingResults(): Promise<{
  results: TaxFilingResult[];
  error: string | null;
}> {
  const baseUrl = apiUrl();
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return { results: [], error: "This page isn't connected to the Money App yet." };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tax-center/export`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (res.status === 404) {
      return {
        results: [],
        error: "The Money App doesn't have the tax center feed yet.",
      };
    }
    if (!res.ok) throw new Error(`Money App returned ${res.status}`);

    const body = await res.json();
    const rows: TaxFilingResult[] = Array.isArray(body?.results) ? body.results : [];
    return { results: rows, error: null };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err.message : "Couldn't reach the Money App.",
    };
  }
}

// ── Google Drive links (stored here, not in Money App) ──────────────────────

export async function getTaxDocuments(): Promise<TaxDocument[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("tax_documents")
    .select("*")
    .order("tax_year", { ascending: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    taxYear: Number(row.tax_year),
    driveUrl: row.drive_url,
    label: row.label ?? null,
  }));
}

