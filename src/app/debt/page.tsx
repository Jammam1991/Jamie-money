import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import {
  getDebtTransactions,
  getDebts,
  getMoneyAppFico,
  hasPlaidItems,
} from "@/lib/store";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const { role, comingSoon } = await pageGate("debt");
  if (comingSoon) return <ComingSoon title="Debt" />;
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
      />
    </div>
  );
}
