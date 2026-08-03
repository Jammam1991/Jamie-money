import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import {
  getDebtTransactions,
  getDebts,
  getMoneyAppFico,
  hasPlaidItems,
} from "@/lib/store";
import { requireVisible } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const role = await requireVisible("debt");
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
