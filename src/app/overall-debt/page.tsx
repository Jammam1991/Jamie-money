import { PageTitle } from "@/components/ui";
import OverallDebtClient from "@/components/OverallDebtClient";
import { requireVisible } from "@/lib/visibility";
import { getOverallDebts, getOverallContext, getOverallDebtPayments } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OverallDebtPage() {
  const role = await requireVisible("overall-debt");

  const [debts, context, payments] = await Promise.all([
    getOverallDebts(),
    getOverallContext(),
    getOverallDebtPayments(),
  ]);

  return (
    <div>
      <PageTitle>Overall Debt</PageTitle>
      <OverallDebtClient
        initialDebts={debts}
        initialContext={context}
        initialPayments={payments}
        admin={role === "admin"}
      />
    </div>
  );
}
