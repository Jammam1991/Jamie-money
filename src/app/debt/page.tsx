import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import {
  client,
  getDebtTransactions,
  getDebts,
  getMoneyAppFico,
  hasPlaidItems,
} from "@/lib/store";
import { autoSyncMoneyAppDebts } from "@/lib/moneyapp";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const { role, comingSoon } = await pageGate("debt");
  if (comingSoon) return <ComingSoon title="Debt" />;

  // Pull Jamie's balances from Money App before reading them, so the page is
  // current without anyone pressing Sync. Throttled to once an hour inside, and
  // it swallows its own failures — a quiet Money App just means the numbers
  // below are the ones from last time.
  const c = client();
  if (c) await autoSyncMoneyAppDebts(c);

  const [debts, hasBank, fico, transactions] = await Promise.all([
    getDebts(),
    hasPlaidItems(),
    getMoneyAppFico(),
    getDebtTransactions(),
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
        currentYear={new Date().getFullYear()}
      />
    </div>
  );
}
