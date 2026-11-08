// ── The one number Jamie is responsible for ──────────────────────────────────
// The same total the full Debt page heads with ("What you owe"): his own cards
// and loans, the gym loans in his name, and his share of what Chris put into
// the gym. The divorce settlement is left out, as it is there — it's deferred,
// and it's shown on its own line instead.
//
// Worked out with the same pieces DebtClient uses (CARRY_CATEGORIES, the
// security deposit, gymShareFigures), so the simple page and "See all the
// details" show the same figure. If that math changes, change it here too.

import type { Debt } from "./data";
import { totalBalance } from "./payoff";
import { CARRY_CATEGORIES } from "./chrisCarry";
import { SECURITY_DEPOSIT } from "./offsets";
import { DEFAULT_SPLIT_PCT, gymShareFigures } from "./monthlyExtras";
import type { InvestmentSplitTerms } from "./store";

export function jamieResponsibleTotal(debts: Debt[], splitTerms: InvestmentSplitTerms): number {
  const business = debts.filter((d) => d.scope === "business");
  const personal = debts.filter((d) => d.scope !== "business");
  const businessTotal = totalBalance(business);
  const dueToChrisTotal = CARRY_CATEGORIES.reduce((s, c) => s + c.balance, 0) - SECURITY_DEPOSIT;
  const { balance: owesChris } = gymShareFigures({
    businessTotal,
    dueToChrisTotal,
    splitPct: splitTerms.splitPct ?? DEFAULT_SPLIT_PCT,
    chrisCarryMonthly: 0,
  });
  return totalBalance(personal) + businessTotal + owesChris;
}
