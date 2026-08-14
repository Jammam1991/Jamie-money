// ── The Big Picture ──────────────────────────────────────────────────────────
// One screen that answers "how does our money actually work?" — the whole
// household, not Jamie's slice of it.
//
// The loop it has to make visible:
//
//   the gym loses money every month  →  Chris draws on a credit line to cover
//   it  →  that draw is what pays Jamie  →  Jamie's bills are bigger than that
//   still  →  Chris draws again  →  the credit left shrinks  →  the debt grows
//
// Every figure here is read from wherever it already lives. Nothing is typed in
// and nothing is stored, so there's no table to create and no copy to go stale:
//
//   the gym's profit      Money App's shared-access feed (see businessFinances)
//   all the debt          Money App's debt export, every scope — the same set
//                         its own /global/debt page totals
//   the credit lines      the limits on those same accounts
//   what Jamie is paid    the gym dashboard's payroll (see gymPay)
//   his massage income    the weekly figure on the Settings screen
//   his bills             the Bills page
//   what Chris lent him   the private loans Money App already mirrors here
//
// Any one of those can be missing — an app that's down, a setting nobody has
// filled in, a bank that doesn't report a credit limit. None of them takes the
// page down: the affected scene says in plain words what it doesn't know, and
// the rest of the story still reads.

import { getBusinessFinances, type Rollup } from "./businessFinances";
import { getPayMonths } from "./gymPay";
import { moneyAppReady } from "./moneyapp";
import { getBills, getDebtTransactions, getWeeklyIncome } from "./store";
import { WEEKS_PER_MONTH } from "./data";

// How many recent whole months the monthly averages are taken over. Three is
// enough to ride out a big one-off month without averaging away what's actually
// happening now.
const AVERAGE_MONTHS = 3;

// How many months of Chris's actual lending the story shows as bars.
const DRAW_MONTHS = 6;

export type Scope = "chris" | "jamie" | "joint" | "lennon" | "business";

export type HouseholdAccount = {
  id: string;
  name: string;
  type: string;
  scope: Scope;
  balance: number;
  apr: number;
  minPayment: number;
  /** The ceiling, when the bank reports one. Null on loans and unlinked rows. */
  creditLimit: number | null;
  /** How much of that ceiling is still there to draw on. */
  availableCredit: number | null;
};

/** One card or line of credit, seen as a fuel gauge rather than a debt. */
export type CreditLine = {
  id: string;
  name: string;
  scope: Scope;
  limit: number;
  used: number;
  available: number;
  /** 0–100, how full the tank still is. */
  leftPct: number;
};

/** One month of money Chris actually handed over, as Money App recorded it. */
export type MonthDraw = {
  month: string; // YYYY-MM
  label: string; // "Jun"
  amount: number;
};

export type Slice = { label: string; amount: number };

export type HouseholdPicture = {
  // ── Scene 1: what we owe ────────────────────────────────────────────────
  totalDebt: number;
  businessDebt: number;
  personalDebt: number;
  /** Every account behind those two numbers, biggest first. */
  accounts: HouseholdAccount[];
  /** Totals per owner, for the drill-down. */
  byScope: { scope: Scope; label: string; amount: number }[];

  // ── Scene 2: Jamie's month ──────────────────────────────────────────────
  /** What lands in his pocket each month, all sources. */
  incomeMonthly: number;
  incomeParts: Slice[];
  /** What goes back out — the Bills page. */
  billsMonthly: number;
  billParts: Slice[];
  /** Bills minus income. Positive means short. */
  gapMonthly: number;
  /** Null when the gym dashboard couldn't be reached — the income is partial. */
  payProblem: string | null;

  // ── Scene 3: who fills the gap ──────────────────────────────────────────
  draws: MonthDraw[];
  drawAverage: number;
  /** Which of Chris's accounts the money came out of, biggest first. */
  drawSources: Slice[];

  // ── Scene 4: why the gym can't pay ──────────────────────────────────────
  /** Average monthly operating profit — negative is a loss. Null if unknown. */
  gymProfitMonthly: number | null;
  gymMonthsLabel: string;
  /** What the gym actually paid Jamie in an average month. */
  gymPayMonthly: number;

  // ── Scenes 5 & 6: the credit left, and how fast it's going ──────────────
  lines: CreditLine[];
  creditLimitTotal: number;
  creditLeftTotal: number;
  /** The gym's monthly loss plus Jamie's monthly shortfall. */
  burnMonthly: number;
  /** `fixLabel` is the same hole said as a target — what scene 7 asks for. */
  burnParts: { label: string; fixLabel: string; amount: number }[];
  /** Credit left divided by the burn. Null when nothing is being burned. */
  monthsLeft: number | null;

  // ── Scene 7: what would close it ────────────────────────────────────────
  /** True when at least one account came back with a real credit limit. */
  hasLimits: boolean;
};

// ── Reading the debt out of Money App ────────────────────────────────────────

type ExportAccount = {
  id: string;
  scope?: string | null;
  name: string;
  type: string;
  balance: number;
  apr: number;
  minPayment: number;
  // Sent only by a Money App new enough to have them. An older one leaves the
  // fuel-gauge scene empty rather than showing a made-up ceiling.
  creditLimit?: number | null;
  availableCredit?: number | null;
};

const SCOPES: Scope[] = ["chris", "jamie", "joint", "lennon", "business"];

function asScope(v: string | null | undefined): Scope {
  return SCOPES.includes(v as Scope) ? (v as Scope) : "joint";
}

export const SCOPE_LABEL: Record<Scope, string> = {
  chris: "Chris's",
  jamie: "Jamie's",
  joint: "Both of ours",
  lennon: "The rental's",
  business: "The gym's",
};

/**
 * Every debt account across the household, in the same two buckets Money App's
 * own all-debt page uses: the personal scopes together, and the gym's.
 *
 * Two requests rather than five — `person=all` covers chris, jamie, joint and
 * the rental in one, and the gym is asked for by scope because it isn't
 * anyone's personally.
 */
async function fetchAccounts(): Promise<{
  accounts: HouseholdAccount[];
  error: string | null;
}> {
  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) {
    return { accounts: [], error: "This page isn't connected to the Money App yet." };
  }

  const url = (query: string) =>
    `${baseUrl.replace(/\/$/, "")}/api/debt/export?${query}`;

  const pull = async (query: string): Promise<ExportAccount[] | null> => {
    try {
      const res = await fetch(url(query), {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });
      // A Money App that predates `person=all` answers 400. That's worth
      // falling back for rather than failing: without it the page can still
      // show the gym's debt and Jamie's own.
      if (!res.ok) return null;
      const body = await res.json();
      return Array.isArray(body?.debts) ? (body.debts as ExportAccount[]) : [];
    } catch {
      return null;
    }
  };

  let personal = await pull("person=all");
  if (personal === null) {
    // Older Money App: ask person by person for the same set.
    const parts = await Promise.all(
      ["chris", "jamie", "lennon"].map((p) => pull(`person=${p}`)),
    );
    personal = parts.filter((p): p is ExportAccount[] => p !== null).flat();
    if (personal.length === 0) personal = [];
  }

  const business = (await pull("scope=business")) ?? [];

  // `person=jamie` and `person=chris` both carry the joint accounts, so the
  // fallback path above can hand the same account back more than once. Keyed by
  // id, the household total can't double-count one.
  const byId = new Map<string, HouseholdAccount>();
  for (const a of [...personal, ...business.map((b) => ({ ...b, scope: "business" }))]) {
    byId.set(String(a.id), {
      id: String(a.id),
      name: a.name,
      type: a.type,
      scope: asScope(a.scope),
      balance: Number(a.balance) || 0,
      apr: Number(a.apr) || 0,
      minPayment: Number(a.minPayment) || 0,
      creditLimit: a.creditLimit != null ? Number(a.creditLimit) : null,
      availableCredit: a.availableCredit != null ? Number(a.availableCredit) : null,
    });
  }

  const accounts = [...byId.values()]
    .filter((a) => a.balance > 0 || (a.creditLimit ?? 0) > 0)
    .sort((a, b) => b.balance - a.balance);

  if (accounts.length === 0) {
    return { accounts: [], error: "The Money App didn't send any debt accounts." };
  }
  return { accounts, error: null };
}

// ── The months the averages are taken over ───────────────────────────────────

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The last `n` whole months, oldest first. The month in progress is left out on
 * purpose: a month that's three days old always looks like a collapse next to
 * the ones beside it.
 */
function lastWholeMonths(n: number, from: Date): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = from.getFullYear();
  let m = from.getMonth(); // already the previous month, 1-indexed
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  for (let i = 0; i < n; i++) {
    out.push({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out.reverse();
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ── Putting it together ──────────────────────────────────────────────────────

/**
 * The whole picture, or a plain-words reason there isn't one.
 *
 * Never throws. Every source is allowed to be missing; only the debt itself is
 * required, because without it there is no picture to draw.
 */
export async function getHouseholdPicture(): Promise<{
  picture: HouseholdPicture | null;
  error: string | null;
}> {
  if (!moneyAppReady()) {
    return { picture: null, error: "This page isn't connected to the Money App yet." };
  }

  const today = new Date();
  const months = lastWholeMonths(AVERAGE_MONTHS, today);

  const [debtResult, payResult, bills, weekly, loans, gymMonths] = await Promise.all([
    fetchAccounts(),
    getPayMonths(12),
    getBills(),
    getWeeklyIncome(),
    getDebtTransactions(),
    Promise.all(months.map((m) => getBusinessFinances(m.year, m.month))),
  ]);

  if (debtResult.accounts.length === 0) {
    return { picture: null, error: debtResult.error ?? "Couldn't reach the Money App." };
  }

  const accounts = debtResult.accounts;
  const businessDebt = sum(accounts.filter((a) => a.scope === "business").map((a) => a.balance));
  const personalDebt = sum(accounts.filter((a) => a.scope !== "business").map((a) => a.balance));

  const byScope = SCOPES.map((s) => ({
    scope: s,
    label: SCOPE_LABEL[s],
    amount: sum(accounts.filter((a) => a.scope === s).map((a) => a.balance)),
  })).filter((s) => s.amount > 0);

  // ── Jamie's month ──────────────────────────────────────────────────────
  // Only whole months, and only ones the gym dashboard has anything for — a
  // run of empty months before he started would drag the average to nothing.
  const payMonths = payResult.months
    .filter((m) => !m.isCurrentMonth)
    .slice(0, AVERAGE_MONTHS);
  const gymPayMonthly = average(payMonths.map((m) => m.took));
  const massageMonthly = weekly * WEEKS_PER_MONTH;

  const incomeParts: Slice[] = [
    { label: "Paid by the gym", amount: gymPayMonthly },
    { label: "Massage work", amount: massageMonthly },
  ].filter((p) => p.amount > 0);
  const incomeMonthly = sum(incomeParts.map((p) => p.amount));

  const billParts: Slice[] = [...bills]
    .map((b) => ({ label: b.name, amount: b.amount }))
    .sort((a, b) => b.amount - a.amount);
  const billsMonthly = sum(billParts.map((b) => b.amount));
  const gapMonthly = billsMonthly - incomeMonthly;

  // ── What Chris actually handed over ────────────────────────────────────
  // These are the "Private Loans:Jamie" lines Money App already mirrors here —
  // real transactions, not a figure worked out from the gap above. A repayment
  // arrives as a negative and is kept, so a month reads as what was borrowed
  // net of what went back.
  const drawWindow = lastWholeMonths(DRAW_MONTHS, today);
  const drawByMonth = new Map<string, number>();
  for (const { year, month } of drawWindow) drawByMonth.set(monthKey(year, month), 0);

  const sourceTotals = new Map<string, number>();
  for (const tx of loans) {
    const key = tx.txDate.slice(0, 7);
    if (!drawByMonth.has(key)) continue;
    drawByMonth.set(key, (drawByMonth.get(key) ?? 0) + tx.amount);
    const source = tx.source ?? "Chris";
    sourceTotals.set(source, (sourceTotals.get(source) ?? 0) + tx.amount);
  }

  const draws: MonthDraw[] = drawWindow.map(({ year, month }) => ({
    month: monthKey(year, month),
    label: MONTH_SHORT[month - 1],
    amount: drawByMonth.get(monthKey(year, month)) ?? 0,
  }));
  const drawSources: Slice[] = [...sourceTotals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const drawnMonths = draws.filter((d) => d.amount > 0);
  const drawAverage = average(drawnMonths.map((d) => d.amount));

  // ── Why the gym can't pay him ──────────────────────────────────────────
  // Operating profit, not net profit: grant money folded back in would say the
  // gym covered its own costs in a month it didn't. Same figure the Business
  // Finances headline uses.
  const gymProfits = gymMonths
    .map((r) => r.data?.actual)
    .filter((r): r is Rollup => r != null)
    .map((r) => r.income - r.cogs - r.expenses);
  const gymProfitMonthly = gymProfits.length > 0 ? average(gymProfits) : null;
  const gymMonthsLabel = months
    .map(({ year, month }) => `${MONTH_SHORT[month - 1]} ${year}`)
    .join(", ");

  // ── The credit left, and the burn against it ───────────────────────────
  const lines: CreditLine[] = accounts
    .filter((a) => (a.creditLimit ?? 0) > 0)
    .map((a) => {
      const limit = a.creditLimit as number;
      const available = Math.min(limit, Math.max(0, a.availableCredit ?? limit - a.balance));
      return {
        id: a.id,
        name: a.name,
        scope: a.scope,
        limit,
        used: Math.max(0, limit - available),
        available,
        leftPct: Math.round((available / limit) * 100),
      };
    })
    .sort((a, b) => b.available - a.available);

  const creditLimitTotal = sum(lines.map((l) => l.limit));
  const creditLeftTotal = sum(lines.map((l) => l.available));

  // What has to be found from somewhere every month. The gym's loss and
  // Jamie's shortfall are separate pots — what the gym pays him is already an
  // expense inside its loss and income inside his month, so adding the two
  // counts neither twice.
  const gymLoss = gymProfitMonthly != null && gymProfitMonthly < 0 ? -gymProfitMonthly : 0;
  const jamieShort = Math.max(0, gapMonthly);
  const burnParts = [
    {
      label: "The gym's monthly loss",
      fixLabel: "The gym needs to make",
      amount: gymLoss,
    },
    {
      label: "Jamie short on bills",
      fixLabel: "Jamie needs to bring in",
      amount: jamieShort,
    },
  ].filter((p) => p.amount > 0);
  const burnMonthly = sum(burnParts.map((p) => p.amount));

  const monthsLeft =
    burnMonthly > 0 && creditLeftTotal > 0 ? creditLeftTotal / burnMonthly : null;

  return {
    picture: {
      totalDebt: businessDebt + personalDebt,
      businessDebt,
      personalDebt,
      accounts,
      byScope,

      incomeMonthly,
      incomeParts,
      billsMonthly,
      billParts,
      gapMonthly,
      payProblem: payResult.problem,

      draws,
      drawAverage,
      drawSources,

      gymProfitMonthly,
      gymMonthsLabel,
      gymPayMonthly,

      lines,
      creditLimitTotal,
      creditLeftTotal,
      burnMonthly,
      burnParts,
      monthsLeft,

      hasLimits: lines.length > 0,
    },
    error: null,
  };
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function average(ns: number[]): number {
  return ns.length === 0 ? 0 : sum(ns) / ns.length;
}
