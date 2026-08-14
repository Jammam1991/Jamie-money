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
import {
  getBills,
  getDebtTransactions,
  getHouseholdIncome,
  getWeeklyIncome,
} from "./store";
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

/** One rung of the waterfall: what gets taken, and what's still standing after. */
export type FlowStep = {
  key: string;
  emoji: string;
  label: string;
  /** Always positive — it's money going out. */
  amount: number;
  /** What's left of the month's income once this step is paid. Can go below 0. */
  remaining: number;
  /** Plain-words note under the step, where the source needs saying. */
  note?: string;
};

/** Everything in, everything out, and the order it leaves in. */
export type MoneyFlow = {
  incomeMonthly: number;
  incomeParts: Slice[];
  /** Every step's amount added up — the "total expenses" headline. */
  outMonthly: number;
  steps: FlowStep[];
  /** What's left when the last step is paid. Negative is the monthly hole. */
  shortfall: number;
  /** True when Chris's pay or the rent hasn't been filled in yet. */
  incomeIncomplete: boolean;
  /** True when Money App had no budget rows, so living costs read as zero. */
  budgetMissing: boolean;
};

export type HouseholdPicture = {
  // ── Scene 1: what we owe ────────────────────────────────────────────────
  totalDebt: number;
  businessDebt: number;
  /** Chris, Jamie and joint — the household's own debt, rental excluded. */
  personalDebt: number;
  /** The rental property's own mortgage and deferred balance. */
  rentalDebt: number;
  /** Every account behind those two numbers, biggest first. */
  accounts: HouseholdAccount[];
  /** Totals per owner, biggest slice of the story first. Drives the top cards. */
  byScope: { scope: Scope; label: string; name: string; amount: number }[];

  // ── Scene 2: where the household's money goes ───────────────────────────
  /** Null when neither income figure is set — the scene sits out rather than
   *  claiming the household lives on the gym's revenue alone. */
  flow: MoneyFlow | null;

  // ── Scene 3: Jamie's month ──────────────────────────────────────────────
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

  // ── What we've put into this ─────────────────────────────────────────────
  /** Null when Money App doesn't have the investment feed yet (a caller
   *  update ahead of Money App's own deploy). */
  investment: Investment | null;
};

/** What's actually gone into the gym so far — two balance-sheet accounts,
 *  not a year's activity, so there's no "through date" on this one. */
export type Investment = {
  /** Chris's contribution to buying the gym — Jamie's own pre-acquisition
   *  money is excluded on Money App's side. */
  initialInvestment: number;
  /** What the business owes Chris back: the acquisition funding plus every
   *  draw since that's covered Jamie's pay when the gym couldn't. */
  dueToChris: number;
  /** Net change in `dueToChris` over the most recently completed month. */
  dueToChrisLastMonth: number;
  /** `initialInvestment + dueToChris` — what walking away would cost. */
  totalInvested: number;
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

// The order the owners are read in, which is not the order above: the two of
// them first, then what they own. Joint sits with the personal scopes because
// that's what it is.
const SCOPE_ORDER: Scope[] = ["chris", "jamie", "joint", "business", "lennon"];

function asScope(v: string | null | undefined): Scope {
  return SCOPES.includes(v as Scope) ? (v as Scope) : "joint";
}

/** Possessive — reads as part of a sentence ("Chris's · $12,900 used of…"). */
export const SCOPE_LABEL: Record<Scope, string> = {
  chris: "Chris's",
  jamie: "Jamie's",
  joint: "Both of ours",
  lennon: "The rental's",
  business: "The gym's",
};

/** Plain — the name on its own, for the cards at the top of the page.
 *  Both Chris's and Jamie's are spelled out on purpose: each is only the
 *  balance on accounts the bank has in that person's own name, not
 *  everything they're on the hook for — the business's own debt sits in its
 *  own card even where an account is legally Chris's, and what Chris lends
 *  Jamie personally (scene 3's draws) sits on HIS accounts and isn't in
 *  hers, so reading either as "everything they owe" undersells the real
 *  number. */
export const SCOPE_NAME: Record<Scope, string> = {
  chris: "Chris (Secured)",
  jamie: "Jamie (Bank Secured)",
  joint: "Joint",
  lennon: "Rental Property",
  business: "Business",
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

/**
 * What's gone into the gym so far. Null on anything short of a clean
 * response — an older Money App without the endpoint yet, a network hiccup —
 * since this is a bonus scene, not one the rest of the page depends on.
 */
async function fetchInvestment(): Promise<Investment | null> {
  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/business/investment`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<Investment>;
    if (
      typeof body.initialInvestment !== "number" ||
      typeof body.dueToChris !== "number" ||
      typeof body.dueToChrisLastMonth !== "number" ||
      typeof body.totalInvested !== "number"
    ) {
      return null;
    }
    return {
      initialInvestment: body.initialInvestment,
      dueToChris: body.dueToChris,
      dueToChrisLastMonth: body.dueToChrisLastMonth,
      totalInvested: body.totalInvested,
    };
  } catch {
    return null;
  }
}

// ── What the household plans to spend, from Money App's budget ───────────────
// The gym is deliberately left out of the request: its costs come from the
// shared-access feed as what actually happened, and asking for the business
// budget too would count the same money twice.
//
// Planned, not spent. Money App has no per-person actuals feed — see the note
// on its /api/budget/export — so the page says "planned" wherever this shows.
async function fetchLivingCosts(): Promise<{ total: number; lines: Slice[] } | null> {
  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/budget/export?scopes=chris,jamie,joint`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    // A Money App that predates the endpoint 404s. That's not an error worth
    // showing — the scene says the budget isn't reaching it and moves on.
    if (!res.ok) return null;
    const body = await res.json();
    const lines: { category: string; effective: number }[] = Array.isArray(body?.lines)
      ? body.lines
      : [];
    if (lines.length === 0) return null;

    // One row per category name across the three scopes — "Groceries" budgeted
    // under both Chris and Joint is one line to read, not two.
    const byCategory = new Map<string, number>();
    for (const l of lines) {
      const amount = Number(l.effective) || 0;
      if (amount <= 0) continue;
      byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + amount);
    }

    const merged = [...byCategory.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { total: sum(merged.map((l) => l.amount)), lines: merged };
  } catch {
    return null;
  }
}

// ── What the banks take, split into their two halves ─────────────────────────
/**
 * A month's interest and a month's principal across every account.
 *
 * Interest is the balance at its own rate for one month. Principal is whatever
 * of the minimum payment is left once that interest is covered — which is the
 * honest way round: on a maxed-out card at 25% almost the whole payment is
 * interest, and showing the payment as one number hides exactly that.
 *
 * An account whose minimum doesn't even cover its interest contributes zero
 * principal rather than a negative one. That's not a rounding choice — it's a
 * balance that grows while being paid, and a negative here would quietly
 * cancel out real principal being paid elsewhere.
 */
function bankSplit(accounts: HouseholdAccount[]): { interest: number; principal: number } {
  let interest = 0;
  let principal = 0;
  for (const a of accounts) {
    const monthly = (a.balance * (a.apr / 100)) / 12;
    interest += monthly;
    principal += Math.max(0, a.minPayment - monthly);
  }
  return { interest, principal };
}

// ── Chris's pay and the rent, read rather than typed ─────────────────────────
// Both live in Money App's personal ledger and are classified there — same
// income-category test, same transfer rules, same dedupe for a paycheck split
// across two accounts. Asking for the answer beats working it out here, where a
// second opinion on "what counts as income" would drift from the first.
//
// The figures Chris typed into Settings stay as a fallback: they're what the
// page ran on before this feed existed, and they keep it standing if Money App
// is unreachable or hasn't deployed the endpoint yet.
async function fetchLedgerIncome(
  months: { year: number; month: number }[],
): Promise<{ chris: number | null; rental: number | null }> {
  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey || months.length === 0) return { chris: null, rental: null };

  const first = months[0];
  const last = months[months.length - 1];
  const ym = (m: { year: number; month: number }) =>
    `${m.year}-${String(m.month).padStart(2, "0")}`;

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/household/income?from=${ym(first)}&to=${ym(last)}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) return { chris: null, rental: null };
    const body = await res.json();
    // A real zero is an answer — it means nothing landed in those months — but
    // only when Money App actually found rows to look at. No rows at all is
    // "we don't know", which has to stay null so the Settings figure can stand
    // in rather than being overridden by a zero.
    const read = (v: { monthly?: number; count?: number } | undefined) =>
      v && typeof v.monthly === "number" && (v.count ?? 0) > 0 ? v.monthly : null;
    return { chris: read(body?.chrisPay), rental: read(body?.rentalIncome) };
  } catch {
    return { chris: null, rental: null };
  }
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

  const [
    debtResult,
    payResult,
    bills,
    weekly,
    loans,
    gymMonths,
    livingCosts,
    typedIncome,
    ledgerIncome,
    investment,
  ] = await Promise.all([
      fetchAccounts(),
      getPayMonths(12),
      getBills(),
      getWeeklyIncome(),
      getDebtTransactions(),
      Promise.all(months.map((m) => getBusinessFinances(m.year, m.month))),
      fetchLivingCosts(),
      getHouseholdIncome(),
      fetchLedgerIncome(months),
      fetchInvestment(),
    ]);

  if (debtResult.accounts.length === 0) {
    return { picture: null, error: debtResult.error ?? "Couldn't reach the Money App." };
  }

  const accounts = debtResult.accounts;
  // Three buckets, not two. The rental property is a business of its own —
  // its mortgage sits against an asset that earns rent, which is a different
  // thing from what the two of them owe, and lumping it into "personal" made
  // that number look far worse than it is.
  const totalFor = (keep: (s: Scope) => boolean) =>
    sum(accounts.filter((a) => keep(a.scope)).map((a) => a.balance));

  const businessDebt = totalFor((s) => s === "business");
  const rentalDebt = totalFor((s) => s === "lennon");
  const personalDebt = totalFor((s) => s !== "business" && s !== "lennon");

  // Only owners who actually owe something. Joint in particular is usually
  // empty, and a $0 card next to four real ones just reads as a bug.
  const byScope = SCOPE_ORDER.map((s) => ({
    scope: s,
    label: SCOPE_LABEL[s],
    name: SCOPE_NAME[s],
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

  const gymRollups = gymMonths.map((r) => r.data?.actual).filter((r): r is Rollup => r != null);
  const gymRevenueMonthly = average(gymRollups.map((r) => r.income));
  const gymCostsMonthly = average(gymRollups.map((r) => r.cogs + r.expenses));

  // ── Where the household's money goes ───────────────────────────────────
  // The ledger wins: it's what actually landed, month by month, classified by
  // Money App itself. The Settings figures only stand in where it has nothing.
  const flow = buildFlow({
    chrisIncome: ledgerIncome.chris ?? typedIncome.chris,
    rentalIncome: ledgerIncome.rental ?? typedIncome.rental,
    jamieIncome: incomeMonthly,
    gymRevenue: gymRevenueMonthly,
    gymCosts: gymCostsMonthly,
    living: livingCosts,
    bank: bankSplit(accounts),
  });

  // ── The cash left to draw, and the burn against it ─────────────────────
  // Lines of credit only. A card's headroom isn't cash — it can't cover a
  // mortgage payment or a payroll run, which is what the shortfall below is
  // actually made of. Counting cards made the runway look years longer than
  // the money that can really be drawn.
  //
  // Matched on the type Money App gives the account, with a name check behind
  // it so a line typed in as a card ("Kinecta Personal Loc") still counts.
  const isCashLine = (a: HouseholdAccount) =>
    a.type === "line_of_credit" || /\bline of credit\b|\bloc\b/i.test(a.name);

  const lines: CreditLine[] = accounts
    .filter((a) => isCashLine(a) && (a.creditLimit ?? 0) > 0)
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

  // What has to be found from somewhere every month.
  //
  // Once the whole household's money is on the page, the waterfall's shortfall
  // IS this number and there must not be a second one — two different answers
  // to "how much are we going backwards each month", a few scenes apart, is
  // exactly the confusion this page exists to end. So the flow wins where it
  // exists, and the two parts below are a decomposition of it rather than an
  // independent sum.
  const gymLoss = gymProfitMonthly != null && gymProfitMonthly < 0 ? -gymProfitMonthly : 0;

  let burnParts: { label: string; fixLabel: string; amount: number }[];
  if (flow) {
    const hole = Math.max(0, -flow.shortfall);
    // The gym's share first, because it's the one lever with its own page.
    // Whatever the gym doesn't account for is the household outspending what
    // it earns — together they're the hole exactly, never more or less.
    const gymShare = Math.min(gymLoss, hole);
    burnParts = [
      {
        label: "The gym's monthly loss",
        fixLabel: "The gym needs to make",
        amount: gymShare,
      },
      {
        label: "The rest of us spending more than we earn",
        fixLabel: "The household needs",
        amount: hole - gymShare,
      },
    ].filter((p) => p.amount > 0);
  } else {
    // No household view: fall back to the two pots that are knowable on their
    // own. What the gym pays Jamie is an expense inside its loss and income
    // inside his month, so adding these counts neither twice.
    burnParts = [
      { label: "The gym's monthly loss", fixLabel: "The gym needs to make", amount: gymLoss },
      {
        label: "Jamie short on bills",
        fixLabel: "Jamie needs to bring in",
        amount: Math.max(0, gapMonthly),
      },
    ].filter((p) => p.amount > 0);
  }
  const burnMonthly = sum(burnParts.map((p) => p.amount));

  const monthsLeft =
    burnMonthly > 0 && creditLeftTotal > 0 ? creditLeftTotal / burnMonthly : null;

  return {
    picture: {
      flow,

      totalDebt: businessDebt + personalDebt + rentalDebt,
      businessDebt,
      personalDebt,
      rentalDebt,
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

      investment,
    },
    error: null,
  };
}

/**
 * Everything in against everything out, in the order the money actually leaves:
 * the household and the gym are kept running first, then the banks take their
 * interest, then whatever of the minimum payments is left goes at the balances.
 * Anything still owed at the bottom goes onto the credit lines.
 *
 * What the gym pays Jamie is inside `gymCosts` and inside `jamieIncome`, so it
 * appears once on each side and nets to nothing. That's correct for a single
 * household view — it's money moving from one pocket to another, not money
 * arriving or leaving — and it's why the two aren't double-counted.
 *
 * Returns null when neither income figure has been set: with only the gym's
 * revenue on the way in, every step below would read as a catastrophe that
 * isn't real, and a wrong picture is worse than a missing one.
 */
function buildFlow(input: {
  chrisIncome: number | null;
  rentalIncome: number | null;
  jamieIncome: number;
  gymRevenue: number;
  gymCosts: number;
  living: { total: number; lines: Slice[] } | null;
  bank: { interest: number; principal: number };
}): MoneyFlow | null {
  const { chrisIncome, rentalIncome, jamieIncome, gymRevenue, gymCosts, living, bank } = input;
  if (chrisIncome === null && rentalIncome === null) return null;

  const incomeParts: Slice[] = [
    { label: "Chris's pay", amount: chrisIncome ?? 0 },
    { label: "Jamie's income", amount: jamieIncome },
    { label: "Rent from the rental", amount: rentalIncome ?? 0 },
    { label: "The gym takes in", amount: gymRevenue },
  ].filter((p) => p.amount > 0);
  const incomeMonthly = sum(incomeParts.map((p) => p.amount));

  const outgoings: { key: string; emoji: string; label: string; amount: number; note?: string }[] =
    [
      {
        key: "living",
        emoji: "🏠",
        label: "Living expenses",
        amount: living?.total ?? 0,
        note: "Planned monthly budget from Money App, not what actually got spent.",
      },
      {
        key: "gym",
        emoji: "🏋️",
        label: "Running the gym",
        amount: gymCosts,
        note: "What the gym really spent, averaged over the last three whole months.",
      },
      {
        key: "interest",
        emoji: "🏦",
        label: "Interest to the banks",
        amount: bank.interest,
        note: "Every balance at its own rate, for one month. This buys nothing — it's the price of owing.",
      },
      {
        key: "principal",
        emoji: "📉",
        label: "Paying the balances down",
        amount: bank.principal,
        note: "Whatever's left of the minimum payments once the interest is covered.",
      },
    ].filter((s) => s.amount > 0);

  let remaining = incomeMonthly;
  const steps: FlowStep[] = outgoings.map((s) => {
    remaining -= s.amount;
    return { ...s, remaining };
  });

  return {
    incomeMonthly,
    incomeParts,
    outMonthly: sum(outgoings.map((s) => s.amount)),
    steps,
    shortfall: remaining,
    incomeIncomplete: chrisIncome === null || rentalIncome === null,
    budgetMissing: living === null,
  };
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function average(ns: number[]): number {
  return ns.length === 0 ? 0 : sum(ns) / ns.length;
}
