// ── What Chris pays each month on the money he lent the gym ──────────────────
// The Debt page shows Jamie a balance for his share of what's gone into the
// gym, and it sat next to "$0/mo" — as though carrying it cost nothing. It
// doesn't: Chris services that debt every month out of his own accounts.
//
// So this reads Chris's real accounts from Money App, works out how much of
// each month's payment belongs to the money that went to the gym, and hands
// back a figure the page can prorate for Jamie's share.
//
// Nothing here is typed in by hand except the balances, which were already
// hardcoded on the page before this existed.

const MONEYAPP_TIMEOUT_MS = 6000;

// The categories of what Chris has lent the gym, with the account names to look
// for behind each. The balances are Chris's own figures — the same list that
// was already on the Debt page — and only the matching is new.
//
// Two of them have no lender at all: "Income borrowed" is wages Chris didn't
// take, and "Other personal debt" is a rounding-up line. Neither has an account
// or a payment, so both are deliberately left without a `match` and the page
// says the monthly figure doesn't cover them.
export type CarryCategory = {
  key: string;
  label: string;
  balance: number;
  match?: RegExp;
};

export const CARRY_CATEGORIES: CarryCategory[] = [
  { key: "sofi", label: "SoFi personal loans", balance: 39000, match: /sofi/i },
  { key: "kinecta", label: "Kinecta line of credit", balance: 33000, match: /kinecta/i },
  { key: "cards", label: "Credit cards", balance: 32000 }, // matched by type, below
  {
    key: "loc",
    label: "LOC draws & advances",
    balance: 25000,
    // Any other line of credit. Kinecta has its own row above and is excluded
    // there, so it can't be counted in both.
    match: /line of credit|\bloc\b|heloc|advance/i,
  },
  { key: "income", label: "Income borrowed", balance: 15000 },
  { key: "other", label: "Other personal debt", balance: 9000 },
];

export type CarryLine = {
  key: string;
  label: string;
  balance: number; // Chris's figure for what went to the gym
  monthly: number; // that balance's share of the real monthly payments
  matchedBalance: number; // what the matched accounts actually carry
  accounts: string[]; // which accounts were matched, so the number is checkable
};

export type ChrisCarry = {
  lines: CarryLine[];
  /** Every line's monthly added up. */
  monthly: number;
  /** Balance covered by a real account, and balance with nothing behind it. */
  coveredBalance: number;
  uncoveredBalance: number;
  /** Why the figure is missing or partial, in words. Null when all is well. */
  problem: string | null;
};

type ExportAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
  minPayment: number;
};

const EMPTY: ChrisCarry = {
  lines: [],
  monthly: 0,
  coveredBalance: 0,
  uncoveredBalance: 0,
  problem: null,
};

export async function getChrisCarry(): Promise<ChrisCarry> {
  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return { ...EMPTY, problem: "Not connected to Money App, so the monthly cost isn't known." };
  }

  let accounts: ExportAccount[];
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/debt/export?person=chris`,
      {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
        // Chris's accounts are a nice-to-have on this page: without them the
        // row falls back to no monthly figure, which is what it showed before.
        // Never worth holding the whole Debt page open for.
        signal: AbortSignal.timeout(MONEYAPP_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      return { ...EMPTY, problem: `Money App returned ${res.status} for Chris's accounts.` };
    }
    const body = await res.json();
    accounts = Array.isArray(body?.debts) ? (body.debts as ExportAccount[]) : [];
  } catch {
    return { ...EMPTY, problem: "Couldn't reach Money App for Chris's accounts." };
  }

  const live = accounts.filter((a) => Number(a.balance) > 0);
  if (live.length === 0) {
    return { ...EMPTY, problem: "Money App has no open accounts for Chris." };
  }

  // An account can only belong to one category. Claimed in list order, so the
  // specific names (SoFi, Kinecta) take theirs before the loose "line of
  // credit" rule can sweep them up.
  const taken = new Set<string>();
  const lines: CarryLine[] = [];

  for (const category of CARRY_CATEGORIES) {
    const matched = live.filter((a) => {
      if (taken.has(a.id)) return false;
      if (category.key === "cards") return a.type === "credit_card";
      return category.match ? category.match.test(a.name) : false;
    });
    for (const a of matched) taken.add(a.id);

    const matchedBalance = matched.reduce((sum, a) => sum + Number(a.balance), 0);
    const matchedMonthly = matched.reduce((sum, a) => sum + Number(a.minPayment), 0);

    // Only part of an account may have gone to the gym — Chris carries personal
    // cards too. So the payment is taken in the same proportion as the balance
    // Chris says went there, capped at the whole payment: a category can never
    // claim more of an account's payment than the account actually costs.
    const share =
      matchedBalance > 0 ? Math.min(1, category.balance / matchedBalance) : 0;

    lines.push({
      key: category.key,
      label: category.label,
      balance: category.balance,
      monthly: matchedMonthly * share,
      matchedBalance,
      accounts: matched.map((a) => a.name),
    });
  }

  const covered = lines.filter((l) => l.matchedBalance > 0);
  const coveredBalance = covered.reduce((sum, l) => sum + l.balance, 0);
  const uncoveredBalance = lines
    .filter((l) => l.matchedBalance === 0)
    .reduce((sum, l) => sum + l.balance, 0);

  return {
    lines,
    monthly: lines.reduce((sum, l) => sum + l.monthly, 0),
    coveredBalance,
    uncoveredBalance,
    problem:
      coveredBalance === 0
        ? "None of Chris's accounts matched the money lent to the gym, so the monthly cost isn't known."
        : null,
  };
}
