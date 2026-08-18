import { after } from "next/server";
import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import {
  client,
  getDebtTransactions,
  getDebts,
  getDebtSnapshotRows,
  getDivorce,
  getInvestmentSplitTerms,
  getSettlementTerms,
  getJamieSpending,
  getMoneyAppFico,
  hasPlaidItems,
} from "@/lib/store";
import { autoSyncMoneyAppDebts } from "@/lib/moneyapp";
import { getPayMonths } from "@/lib/gymPay";
import { getChrisCarry } from "@/lib/chrisCarry";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

// This page waits on the gym dashboard, which can take up to GYM_TIMEOUT_MS
// (20s) to build Jamie's pay on a cold cache. The platform's default execution
// limit is shorter than that, so without this the render would be killed before
// the wait it's willing to do ever finished — a timeout dressed up as a broken
// connection.
export const maxDuration = 30;

// This month as YYYY-MM, which is how transaction dates are stored — so "new
// debt this month" can be a string comparison. Built from the local parts
// rather than toISOString(), which would flip to next month late on the 31st.
function monthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DebtPage() {
  const { role, comingSoon } = await pageGate("debt");
  if (comingSoon) return <ComingSoon title="Debt" />;

  // Pull Jamie's balances from Money App, so the page stays current without
  // anyone pressing Sync. Throttled to once an hour inside, and it swallows its
  // own failures — a quiet Money App just means the numbers are last time's.
  //
  // This runs *after* the page has been sent, not before it. Waiting on it made
  // opening Debt sit on a blank screen for as long as Money App took to answer,
  // and for nothing: the throttle already means what's on screen can be an hour
  // old, so a pull that lands one page-view later costs no freshness. A nightly
  // cron (/api/moneyapp/cron) is the real backstop either way.
  const c = client();
  if (c) after(() => autoSyncMoneyAppDebts(c));

  const [
    debts,
    hasBank,
    fico,
    transactions,
    spending,
    snapshots,
    payMonths,
    divorce,
    settlementTerms,
    investmentSplitTerms,
    chrisCarry,
  ] = await Promise.all([
    getDebts(),
    hasPlaidItems(),
    getMoneyAppFico(),
    getDebtTransactions(),
    getJamieSpending(),
    getDebtSnapshotRows(),
    getPayMonths(),
    getDivorce(),
    getSettlementTerms(),
    getInvestmentSplitTerms(),
    getChrisCarry(),
  ]);

  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <DebtClient
        initialDebts={debts}
        admin={role === "admin"}
        hasBank={hasBank}
        fico={fico}
        initialTransactions={transactions}
        spending={spending}
        snapshots={snapshots}
        payMonths={payMonths.months}
        payProblem={payMonths.problem}
        currentYear={new Date().getFullYear()}
        currentMonth={monthKey()}
        settlementMonthly={divorce.support.amount}
        settlementTerms={settlementTerms}
        investmentSplitTerms={investmentSplitTerms}
        chrisCarry={chrisCarry}
      />
    </div>
  );
}
