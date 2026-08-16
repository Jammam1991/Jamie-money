import { monthlyPayment, totalBalance } from "./payoff";
import { SECURITY_DEPOSIT } from "./offsets";
import { CARRY_CATEGORIES, getChrisCarry } from "./chrisCarry";
import {
  getDebts,
  getDivorce,
  getInvestmentSplitTerms,
  getSettlementTerms,
  type SettlementTerms,
} from "./store";

// ── The two monthly payments that aren't debts ───────────────────────────────
// Everything else Jamie pays each month has a row in the debts table. These two
// don't: the divorce settlement is worked out from terms Chris sets, and the
// gym share is a slice of what Chris pays on money he lent the business.
//
// Both are real monthly obligations, and both are exactly the kind of thing
// that gets deferred — so they have to be markable like any other debt. That
// means Settings needs their figures too, which is why the maths lives here
// instead of inside the Debt page: one copy, called from both, so the switch in
// Settings and the card on the Debt page can never disagree about the amount.

// Stable ids. They aren't database rows, so these are what "deferred" is keyed
// on for them — they must not change, or a deferral silently detaches.
export const SETTLEMENT_ROW_ID = "__settlement__";
export const CARRY_ROW_ID = "__chris_carry__";

export const SETTLEMENT_MONTHS = 60; // five years
export const SETTLEMENT_APR = 0; // a settlement doesn't charge interest unless Chris says so
export const DEFAULT_SPLIT_PCT = 50;

/** What the settlement comes to, from the terms Chris set or the fallback. */
export function settlementFigures(
  supportMonthly: number,
  terms: SettlementTerms,
): { balance: number; apr: number; months: number; monthly: number } {
  const months = terms.months ?? SETTLEMENT_MONTHS;
  const apr = terms.apr ?? SETTLEMENT_APR;
  const balance = terms.total ?? supportMonthly * months;
  return { balance, apr, months, monthly: monthlyPayment(balance, apr, months) };
}

/**
 * Jamie's share of the gym investment, and of what it costs Chris to carry it.
 *
 * His share of the cost is the same fraction as his share of the balance — he
 * owes that much of what Chris is carrying, so he owes that much of the monthly
 * bill for carrying it. Any other fraction would be a second split nobody
 * agreed to.
 */
export function gymShareFigures({
  businessTotal,
  dueToChrisTotal,
  splitPct,
  chrisCarryMonthly,
}: {
  businessTotal: number;
  dueToChrisTotal: number;
  splitPct: number;
  chrisCarryMonthly: number;
}): { balance: number; share: number; monthly: number } {
  const totalInvestment = businessTotal + dueToChrisTotal;
  const jamieInvestmentShare = totalInvestment * (splitPct / 100);
  const balance = Math.max(0, jamieInvestmentShare - businessTotal);
  const share = dueToChrisTotal > 0 ? balance / dueToChrisTotal : 0;
  return { balance, share, monthly: chrisCarryMonthly * share };
}

export type ExtraPayment = {
  id: string;
  name: string;
  balance: number;
  monthly: number;
};

/**
 * The same two rows, fetched from scratch — for Settings, which otherwise has
 * no reason to load any of this.
 */
export async function getExtraPayments(): Promise<ExtraPayment[]> {
  const [debts, divorce, settlementTerms, splitTerms, chrisCarry] =
    await Promise.all([
      getDebts(),
      getDivorce(),
      getSettlementTerms(),
      getInvestmentSplitTerms(),
      getChrisCarry(),
    ]);

  const settlement = settlementFigures(divorce.support.amount, settlementTerms);
  const gym = gymShareFigures({
    // Money App tags the gym's accounts outright; the names give no usable
    // rule. Anything untagged is personal — the same test the Debt page uses.
    businessTotal: totalBalance(debts.filter((d) => d.scope === "business")),
    dueToChrisTotal: dueToChrisTotal(),
    splitPct: splitTerms.splitPct ?? DEFAULT_SPLIT_PCT,
    chrisCarryMonthly: chrisCarry.monthly,
  });

  return [
    {
      id: SETTLEMENT_ROW_ID,
      name: "Divorce Settlement Loan",
      balance: settlement.balance,
      monthly: settlement.monthly,
    },
    {
      id: CARRY_ROW_ID,
      name: "Personal debt for business",
      balance: gym.balance,
      monthly: gym.monthly,
    },
  ];
}

/**
 * What Chris is personally carrying for the gym: the categories of money he put
 * in, less the security deposit that's due back — the deposit reduces what went
 * INTO the gym, and what went in is what gets split.
 */
export function dueToChrisTotal(): number {
  return (
    CARRY_CATEGORIES.reduce((sum, c) => sum + c.balance, 0) - SECURITY_DEPOSIT
  );
}
