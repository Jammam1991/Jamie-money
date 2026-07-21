import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { plaidClient, plaidReady, PLAID_COUNTRY_CODES, PLAID_PRODUCTS } from "@/lib/plaid";

export const runtime = "nodejs";

// POST /api/plaid/link-token → { link_token }
// Creates the short-lived token that opens Plaid's "connect your bank" popup.
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }
  if (!plaidReady()) {
    return NextResponse.json(
      { error: "Bank connection isn't set up yet (Plaid keys missing)." },
      { status: 503 },
    );
  }
  try {
    const resp = await plaidClient().linkTokenCreate({
      user: { client_user_id: "jamie" },
      client_name: "Jamie Money",
      language: "en",
      country_codes: PLAID_COUNTRY_CODES,
      products: PLAID_PRODUCTS,
    });
    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (err) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error("[plaid/link-token]", JSON.stringify(e.response?.data ?? e.message ?? String(err)));
    return NextResponse.json({ error: "Couldn't start the bank connection." }, { status: 500 });
  }
}
